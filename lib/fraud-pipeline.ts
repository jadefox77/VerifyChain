// =============================================================================
// VerifyChain Africa — Rule-based Fraud Detection Pipeline
// Full pipeline runs daily via Vercel cron; a fast subset runs on demand from the admin portal
// =============================================================================

import { prisma } from "@/lib/prisma"
import type { AlertSeverity } from "@prisma/client"
import { DRIFT_RADIUS_KM, haversineKm, regionCoords } from "@/lib/regions"


// ── Thresholds ────────────────────────────────────────────────────────────────

// Repeat scans count different sources (devices, or IPs for scans with no
// device), not taps, and only bottle-label scans. One honest customer makes a
// bottle scan and a cap scan, and may tap the label twice, from one phone.
const VELOCITY_SUSPICIOUS = 3      // different sources scanning one bottle label in 24hrs
const VELOCITY_HIGH_CONCERN = 10   // different sources scanning one bottle label in 24hrs
const TELEPORT_SPEED_KMH = 500     // impossible travel speed threshold
// Phone location can be off by a few kilometres, and the bottle and cap taps
// are seconds apart, so short jumps would look like very high speeds.
const TELEPORT_MIN_DISTANCE_KM = 50
const BOT_SCAN_COUNT = 50          // scans from the same device in 2 minutes
// Many phones share one mobile network IP, so a source that is only an IP
// needs far more scans before it counts as a bot. This still catches scripts
// that throw away their device cookie.
const BOT_IP_SCAN_COUNT = 300      // scans from the same hashed IP in 2 minutes
const BOT_TIME_WINDOW_MS = 2 * 60 * 1000

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

  // ── 1. Repeat scan detection ──────────────────────────────────────────────
  // Bottle labels scanned from VELOCITY_SUSPICIOUS or more different sources
  // in the last 24 hours. The groupBy is a cheap first pass on raw scans; the
  // sources are then counted for the bottles that pass it.

  const candidates = await prisma.scanLog.groupBy({
    by: ["bottleId"],
    _count: true,
    where: {
      bottleId: { not: null },
      scanLayer: "BOTTLE",
      scannedAt: { gte: since },
    },
    having: {
      bottleId: {
        _count: { gte: VELOCITY_SUSPICIOUS },
      },
    },
  })

  const candidateIds = candidates
    .map((c) => c.bottleId)
    .filter((id): id is string => Boolean(id))

  const [candidateScans, candidateBottles] = candidateIds.length
    ? await Promise.all([
        prisma.scanLog.findMany({
          where: {
            bottleId: { in: candidateIds },
            scanLayer: "BOTTLE",
            scannedAt: { gte: since },
          },
          select: { id: true, bottleId: true, deviceHash: true, ipHash: true },
        }),
        prisma.bottle.findMany({
          where: { id: { in: candidateIds } },
          select: {
            id: true,
            serialId: true,
            manufacturerId: true,
            batch: {
              select: {
                batchCode: true,
                product: { select: { name: true } },
              },
            },
          },
        }),
      ])
    : [[], []]

  // A scan with neither hash (an old record, or no QR_SECRET) counts as its
  // own source, so it is never merged with another scan.
  const sourcesByBottle = new Map<string, Set<string>>()
  const tapsByBottle = new Map<string, number>()
  for (const scan of candidateScans) {
    if (!scan.bottleId) continue
    const source = scan.deviceHash
      ? `device:${scan.deviceHash}`
      : scan.ipHash
        ? `ip:${scan.ipHash}`
        : `scan:${scan.id}`
    if (!sourcesByBottle.has(scan.bottleId)) sourcesByBottle.set(scan.bottleId, new Set())
    sourcesByBottle.get(scan.bottleId)!.add(source)
    tapsByBottle.set(scan.bottleId, (tapsByBottle.get(scan.bottleId) ?? 0) + 1)
  }

  for (const bottle of candidateBottles) {
    const sourceCount = sourcesByBottle.get(bottle.id)?.size ?? 0
    if (sourceCount < VELOCITY_SUSPICIOUS) continue
    checks.velocity++

    const taps = tapsByBottle.get(bottle.id) ?? sourceCount
    const severity: AlertSeverity =
      sourceCount >= VELOCITY_HIGH_CONCERN ? "HIGH_CONCERN" : "SUSPICIOUS"
    const confidence = Math.min(0.5 + (sourceCount / 20) * 0.5, 0.99)

    // Skip if there is already an unresolved alert for this bottle
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
          severity,
          manufacturerId: bottle.manufacturerId,
          message: `Bottle ${bottle.serialId} label scanned from ${sourceCount} different devices or connections in 24 hours. Copies of this code may be in circulation.`,
          detail: JSON.stringify({
            bottleId: bottle.id,
            serialId: bottle.serialId,
            sourceCount,
            scanCount: taps,
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
      if (distKm < TELEPORT_MIN_DISTANCE_KM) continue
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
              message: `Bottle ${bottle.serialId} scanned ${Math.round(distKm)}km apart in ${hoursElapsed.toFixed(1)} hours, too far to travel in that time`,
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

    const targetCoords = regionCoords(batch.targetRegion)
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
  // Same source scanning many bottles in a very short window. A source is the
  // anonymous device when the scan has one, and separately the hashed IP with
  // a much higher threshold.

  const recentScans = await prisma.scanLog.findMany({
    where: {
      OR: [{ deviceHash: { not: null } }, { ipHash: { not: null } }],
      scannedAt: { gte: new Date(Date.now() - BOT_TIME_WINDOW_MS) },
    },
    select: {
      deviceHash: true,
      ipHash: true,
      bottleId: true,
      scannedAt: true,
      manufacturerId: true,
    },
    orderBy: { scannedAt: "asc" },
  })

  // Group by source
  const bySource: Record<string, typeof recentScans> = {}
  const add = (key: string, scan: (typeof recentScans)[number]) => {
    if (!bySource[key]) bySource[key] = []
    bySource[key].push(scan)
  }

  for (const scan of recentScans) {
    if (scan.deviceHash) add(`device:${scan.deviceHash}`, scan)
    if (scan.ipHash) add(`ip:${scan.ipHash}`, scan)
  }

  for (const [key, scans] of Object.entries(bySource)) {
    const isIp = key.startsWith("ip:")
    if (scans.length < (isIp ? BOT_IP_SCAN_COUNT : BOT_SCAN_COUNT)) continue
    const source = key.slice(key.indexOf(":") + 1)

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
          message: `${scans.length} scans from one ${isIp ? "IP address" : "device"} in under 2 minutes, which suggests automated scanning`,
          detail: JSON.stringify({
            sourceType: isIp ? "ip" : "device",
            sourceHash: source.slice(0, 12),
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

// ── Fast pipeline — fraud rates only ─────────────────────────────────────────
// Runs in under 10 seconds — suitable for Hobby plan manual trigger
// Full pipeline runs via daily cron

export async function runFastFraudPipeline(): Promise<PipelineResult> {
  const startTime = Date.now()
  const alertsCreated = 0
  const checks = {
    velocity: 0,
    teleportation: 0,
    drift: 0,
    bot: 0,
    fraud_rates: 0,
  }

  const manufacturers = await prisma.manufacturer.findMany({
    where: { onboardingStatus: "ACTIVE_PRODUCTION" },
    select: { id: true },
  })

  for (const mfr of manufacturers) {
    const [totalScans, fraudScans, totalBottles] = await Promise.all([
      prisma.scanLog.count({ where: { manufacturerId: mfr.id } }),
      prisma.scanLog.count({
        where: { manufacturerId: mfr.id, fraudFlag: true },
      }),
      prisma.bottle.count({ where: { manufacturerId: mfr.id } }),
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
  }

  return {
    ran_at: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    alerts_created: alertsCreated,
    manufacturers_updated: manufacturers.length,
    checks,
  }
}