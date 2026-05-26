// =============================================================================
// VerifyChain Africa — AI Fraud Intelligence Pipeline
// Runs hourly via cron + on-demand via admin portal
// =============================================================================

import { prisma } from "@/lib/prisma"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://verifychain-africa.vercel.app"

// ── Thresholds ────────────────────────────────────────────────────────────────

const VELOCITY_SUSPICIOUS = 3      // scans of same bottle in 24hrs
const VELOCITY_HIGH_CONCERN = 10   // scans of same bottle in 24hrs
const TELEPORT_SPEED_KMH = 500     // impossible travel speed threshold
const DRIFT_RADIUS_KM = 300        // supply chain drift threshold
const BOT_SCAN_COUNT = 50          // scans from same channel in 2 minutes
const BOT_TIME_WINDOW_MS = 2 * 60 * 1000

// ── Haversine ────────────────────────────────────────────────────────────────

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Region coordinates ────────────────────────────────────────────────────────

const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Abuja: { lat: 9.0765, lng: 7.3986 },
  Kano: { lat: 12.0022, lng: 8.592 },
  Rivers: { lat: 4.8156, lng: 7.0498 },
  Oyo: { lat: 7.3775, lng: 3.947 },
  Edo: { lat: 6.335, lng: 5.6037 },
  Anambra: { lat: 6.2104, lng: 6.9623 },
  Kaduna: { lat: 10.5264, lng: 7.4384 },
  Delta: { lat: 5.5329, lng: 5.8987 },
  Ogun: { lat: 7.1604, lng: 3.3497 },
  Enugu: { lat: 6.4584, lng: 7.5464 },
  Imo: { lat: 5.5720, lng: 7.0588 },
  Katsina: { lat: 12.9908, lng: 7.6018 },
  Borno: { lat: 11.8333, lng: 13.151 },
  Sokoto: { lat: 13.0535, lng: 5.2476 },
}

// ── Pipeline result type ──────────────────────────────────────────────────────

export type PipelineResult = {
  ran_at: string
  duration_ms: number
  alerts_created: number
  manufacturers_updated: number
  checks: {
    velocity: number
    teleportation: number
    drift: number
    bot: number
    fraud_rates: number
  }
}

// =============================================================================
// MAIN PIPELINE FUNCTION
// =============================================================================

export async function runFraudPipeline(): Promise<PipelineResult> {
  const startTime = Date.now()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  let alertsCreated = 0
  const checks = {
    velocity: 0,
    teleportation: 0,
    drift: 0,
    bot: 0,
    fraud_rates: 0,
  }

  // ── 1. Velocity anomaly detection ─────────────────────────────────────────
  // Find bottles scanned more than VELOCITY_SUSPICIOUS times in last 24hrs

  const velocityData = await prisma.scanLog.groupBy({
    by: ["bottleId"],
    _count: true,
    where: {
      bottleId: { not: null },
      scannedAt: { gte: since },
    },
    having: {
      bottleId: {
        _count: { gte: VELOCITY_SUSPICIOUS },
      },
    },
  })

  for (const item of velocityData) {
    if (!item.bottleId) continue
    checks.velocity++

    const count = item._count
    const severity =
      count >= VELOCITY_HIGH_CONCERN ? "HIGH_CONCERN" : "SUSPICIOUS"
    const confidence = Math.min(0.5 + (count / 20) * 0.5, 0.99)

    // Check if we already have an unresolved alert for this bottle
    const bottle = await prisma.bottle.findUnique({
      where: { id: item.bottleId },
      select: {
        serialId: true,
        manufacturerId: true,
        batch: {
          select: {
            batchCode: true,
            product: { select: { name: true } },
          },
        },
      },
    })

    if (!bottle) continue

    const existingAlert = await prisma.alertLog.findFirst({
      where: {
        type: "REPEAT_SCAN_ABUSE",
        manufacturerId: bottle.manufacturerId,
        resolved: false,
        message: { contains: bottle.serialId },
      },
    })

    if (!existingAlert) {
      await prisma.alertLog.create({
        data: {
          type: "REPEAT_SCAN_ABUSE",
          severity: severity as any,
          manufacturerId: bottle.manufacturerId,
          message: `Bottle ${bottle.serialId} scanned ${count} times in 24 hours — possible counterfeit distribution`,
          detail: JSON.stringify({
            bottleId: item.bottleId,
            serialId: bottle.serialId,
            scanCount: count,
            product: bottle.batch?.product?.name,
            batchCode: bottle.batch?.batchCode,
            window: "24h",
          }),
          batchId: null,
          confidenceScore: confidence,
        },
      })
      alertsCreated++
    }
  }

  // ── 2. Geographic teleportation detection ─────────────────────────────────
  // Find consecutive scans of the same bottle at impossible speeds

  const bottlesWithMultipleLocations = await prisma.scanLog.groupBy({
    by: ["bottleId"],
    _count: true,
    where: {
      bottleId: { not: null },
      lat: { not: null },
      lng: { not: null },
      scannedAt: { gte: since },
    },
    having: {
      bottleId: { _count: { gte: 2 } },
    },
  })

  for (const item of bottlesWithMultipleLocations) {
    if (!item.bottleId) continue

    const scans = await prisma.scanLog.findMany({
      where: {
        bottleId: item.bottleId,
        lat: { not: null },
        lng: { not: null },
        scannedAt: { gte: since },
      },
      orderBy: { scannedAt: "asc" },
      select: {
        lat: true,
        lng: true,
        scannedAt: true,
        manufacturerId: true,
        bottleId: true,
        region: true,
      },
    })

    for (let i = 1; i < scans.length; i++) {
      const prev = scans[i - 1]
      const curr = scans[i]

      if (!prev.lat || !prev.lng || !curr.lat || !curr.lng) continue

      const distKm = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng)
      const hoursElapsed =
        (curr.scannedAt.getTime() - prev.scannedAt.getTime()) /
        1000 /
        3600

      if (hoursElapsed <= 0) continue

      const speedKmh = distKm / hoursElapsed

      if (speedKmh > TELEPORT_SPEED_KMH) {
        checks.teleportation++

        const bottle = await prisma.bottle.findUnique({
          where: { id: item.bottleId! },
          select: { serialId: true, manufacturerId: true },
        })

        if (!bottle) continue

        const existingAlert = await prisma.alertLog.findFirst({
          where: {
            type: "GEOGRAPHIC_TELEPORTATION",
            manufacturerId: bottle.manufacturerId,
            resolved: false,
            message: { contains: bottle.serialId },
          },
        })

        if (!existingAlert) {
          const confidence = Math.min(
            0.7 + (speedKmh / 2000) * 0.3,
            0.99
          )

          await prisma.alertLog.create({
            data: {
              type: "GEOGRAPHIC_TELEPORTATION",
              severity: "CRITICAL",
              manufacturerId: bottle.manufacturerId,
              message: `Bottle ${bottle.serialId} scanned ${Math.round(distKm)}km apart in ${hoursElapsed.toFixed(1)}hrs — physically impossible`,
              detail: JSON.stringify({
                bottleId: item.bottleId,
                serialId: bottle.serialId,
                distanceKm: Math.round(distKm),
                hoursElapsed: hoursElapsed.toFixed(2),
                speedKmh: Math.round(speedKmh),
                fromRegion: prev.region,
                toRegion: curr.region,
                fromCoords: [prev.lat, prev.lng],
                toCoords: [curr.lat, curr.lng],
              }),
              lat: curr.lat,
              lng: curr.lng,
              region: curr.region,
              confidenceScore: confidence,
            },
          })
          alertsCreated++
        }
      }
    }
  }

  // ── 3. Supply chain drift detection ───────────────────────────────────────
  // Batches scanned outside their targetRegion beyond DRIFT_RADIUS_KM

  const batchesWithRegion = await prisma.batch.findMany({
    where: {
      targetRegion: { not: null },
    },
    select: {
      id: true,
      batchCode: true,
      targetRegion: true,
      manufacturerId: true,
    },
  })

  for (const batch of batchesWithRegion) {
    if (!batch.targetRegion) continue

    const targetCoords = REGION_COORDS[batch.targetRegion]
    if (!targetCoords) continue

    const driftScans = await prisma.scanLog.findMany({
      where: {
        batchId: batch.id,
        lat: { not: null },
        lng: { not: null },
        scannedAt: { gte: since },
      },
      select: {
        lat: true,
        lng: true,
        region: true,
        scannedAt: true,
      },
      take: 50,
    })

    const driftingScans = driftScans.filter((scan) => {
      if (!scan.lat || !scan.lng) return false
      const dist = haversineKm(
        targetCoords.lat,
        targetCoords.lng,
        scan.lat,
        scan.lng
      )
      return dist > DRIFT_RADIUS_KM
    })

    if (driftingScans.length > 0) {
      checks.drift++

      const existingAlert = await prisma.alertLog.findFirst({
        where: {
          type: "SUPPLY_CHAIN_DRIFT",
          manufacturerId: batch.manufacturerId,
          resolved: false,
          detail: { contains: batch.id },
        },
      })

      if (!existingAlert) {
        const worstScan = driftingScans[0]
        const dist = worstScan.lat && worstScan.lng
          ? haversineKm(
              targetCoords.lat,
              targetCoords.lng,
              worstScan.lat,
              worstScan.lng
            )
          : 0

        await prisma.alertLog.create({
          data: {
            type: "SUPPLY_CHAIN_DRIFT",
            severity: "SUSPICIOUS",
            manufacturerId: batch.manufacturerId,
            message: `Batch ${batch.batchCode} (target: ${batch.targetRegion}) scanned ${Math.round(dist)}km outside expected region`,
            detail: JSON.stringify({
              batchId: batch.id,
              batchCode: batch.batchCode,
              targetRegion: batch.targetRegion,
              driftingScanCount: driftingScans.length,
              maxDriftKm: Math.round(dist),
              detectedRegion: worstScan.region,
            }),
            batchId: batch.id,
            lat: worstScan.lat,
            lng: worstScan.lng,
            region: worstScan.region,
            confidenceScore: Math.min(
              0.5 + (driftingScans.length / 10) * 0.4,
              0.95
            ),
          },
        })
        alertsCreated++
      }
    }
  }

  // ── 4. Bot behavior detection ─────────────────────────────────────────────
  // Same channel scanning many different bottles in a very short window

  const recentScans = await prisma.scanLog.findMany({
    where: {
      channel: { not: null },
      scannedAt: { gte: new Date(Date.now() - BOT_TIME_WINDOW_MS) },
    },
    select: {
      channel: true,
      bottleId: true,
      scannedAt: true,
      manufacturerId: true,
    },
    orderBy: { scannedAt: "asc" },
  })

  // Group by channel
  const byChannel: Record<string, typeof recentScans> = {}
  
  for (const scan of recentScans) {
    if (!scan.channel) continue
    if (!byChannel[scan.channel]) byChannel[scan.channel] = []
    byChannel[scan.channel].push(scan)
  }

  for (const [channel, scans] of Object.entries(byChannel)) {
    if (scans.length < BOT_SCAN_COUNT) continue

    checks.bot++

    const uniqueBottles = new Set(scans.map((s) => s.bottleId)).size
    const manufacturerId = scans[0]?.manufacturerId

    if (!manufacturerId) continue

    const existingAlert = await prisma.alertLog.findFirst({
      where: {
        type: "BOT_ACTIVITY",
        manufacturerId,
        resolved: false,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    })

    if (!existingAlert) {
      await prisma.alertLog.create({
        data: {
          type: "BOT_ACTIVITY",
          severity: "HIGH_CONCERN",
          manufacturerId,
          message: `${scans.length} scans from channel "${channel}" in under 2 minutes — possible automated scanning`,
          detail: JSON.stringify({
            channel,
            scanCount: scans.length,
            uniqueBottles,
            windowMs: BOT_TIME_WINDOW_MS,
          }),
          confidenceScore: Math.min(
            0.6 + (scans.length / 200) * 0.4,
            0.98
          ),
        },
      })
      alertsCreated++
    }
  }

  // ── 5. Fraud rate recomputation ───────────────────────────────────────────
  // Update fraudRateCached + totalFraudFlags for all active manufacturers

  const manufacturers = await prisma.manufacturer.findMany({
    where: { onboardingStatus: "ACTIVE_PRODUCTION" },
    select: { id: true },
  })

  let manufacturersUpdated = 0

  for (const mfr of manufacturers) {
    const [totalScans, fraudScans, totalBottles] = await Promise.all([
      prisma.scanLog.count({
        where: { manufacturerId: mfr.id },
      }),
      prisma.scanLog.count({
        where: { manufacturerId: mfr.id, fraudFlag: true },
      }),
      prisma.bottle.count({
        where: { manufacturerId: mfr.id },
      }),
    ])

    const fraudRate =
      totalScans > 0 ? (fraudScans / totalScans) * 100 : 0

    await prisma.manufacturer.update({
      where: { id: mfr.id },
      data: {
        totalScans,
        totalFraudFlags: fraudScans,
        totalBottlesGenerated: totalBottles,
        fraudRateCached: fraudRate,
      },
    })

    checks.fraud_rates++
    manufacturersUpdated++
  }

  return {
    ran_at: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    alerts_created: alertsCreated,
    manufacturers_updated: manufacturersUpdated,
    checks,
  }
}