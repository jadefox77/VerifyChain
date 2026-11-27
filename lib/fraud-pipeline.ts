// =============================================================================
// VerifyChain Africa: rule-based fraud detection pipeline
// The full pipeline runs daily from the Vercel cron; a fast subset (fraud rates only) runs on demand from the admin portal
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
// A single-mode code scanned from this many different sources is likely copied.
const CLONE_MIN_SOURCES = 2
const CLONE_HIGH_CONCERN = 5
const CLONE_CRITICAL = 20
// Upper bound on rows one rule reads per run, so a flood of scans cannot run
// the job out of memory or time. Far above current daily volume.
const MAX_SCANS_PER_RULE = 100_000

// ── Pipeline result type ──────────────────────────────────────────────────────

export type PipelineResult = {
  ran_at: string
  duration_ms: number
  alerts_created: number
  manufacturers_updated: number
  checks: {
    velocity: number
    cloning: number
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
    cloning: 0,
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
                product: { select: { name: true, authMode: true } },
              },
            },
          },
        }),
      ])
    : [[], []]

  const sourcesByBottle = new Map<string, Set<string>>()
  const tapsByBottle = new Map<string, number>()
  for (const scan of candidateScans) {
    if (!scan.bottleId) continue
    const source = sourceKey(scan)
    if (!sourcesByBottle.has(scan.bottleId)) sourcesByBottle.set(scan.bottleId, new Set())
    sourcesByBottle.get(scan.bottleId)!.add(source)
    tapsByBottle.set(scan.bottleId, (tapsByBottle.get(scan.bottleId) ?? 0) + 1)
  }

  const repeatOpen = await openAlertMessages(
    "REPEAT_SCAN_ABUSE",
    candidateBottles.map((b) => b.manufacturerId)
  )

  for (const bottle of candidateBottles) {
    // Single-mode codes are covered by the copied-code rule below.
    if (bottle.batch?.product?.authMode === "SINGLE") continue
    const sourceCount = sourcesByBottle.get(bottle.id)?.size ?? 0
    if (sourceCount < VELOCITY_SUSPICIOUS) continue
    checks.velocity++

    const taps = tapsByBottle.get(bottle.id) ?? sourceCount
    const severity: AlertSeverity =
      sourceCount >= VELOCITY_HIGH_CONCERN ? "HIGH_CONCERN" : "SUSPICIOUS"
    const confidence = Math.min(0.5 + (sourceCount / 20) * 0.5, 0.99)

    // Skip if there is already an unresolved alert for this bottle
    const existingAlert = repeatOpen.some((m) => m.includes(bottle.serialId))

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

  // ── 2. Copied single-mode codes ───────────────────────────────────────────
  // A single-mode code has no cap, so the first scan of a copy says
  // "Genuine". The only sign of copying is the same code being scanned from
  // more than one source. Bottles scanned in the last 24 hours are checked
  // against all of their label scans, so a copy scanned days after the real
  // one is still caught.

  const singleCandidates = await prisma.scanLog.findMany({
    where: {
      scanLayer: "BOTTLE",
      scannedAt: { gte: since },
      bottleId: { not: null },
      bottle: { batch: { product: { authMode: "SINGLE" } } },
    },
    select: { bottleId: true },
    distinct: ["bottleId"],
  })
  const singleIds = singleCandidates
    .map((c) => c.bottleId)
    .filter((id): id is string => Boolean(id))

  if (singleIds.length > 0) {
    const [singleScans, singleBottles] = await Promise.all([
      prisma.scanLog.findMany({
        where: { bottleId: { in: singleIds }, scanLayer: "BOTTLE" },
        select: { id: true, bottleId: true, deviceHash: true, ipHash: true, scannedAt: true },
      }),
      prisma.bottle.findMany({
        where: { id: { in: singleIds } },
        select: {
          id: true,
          serialId: true,
          manufacturerId: true,
          batchId: true,
          batch: { select: { batchCode: true, product: { select: { name: true } } } },
        },
      }),
    ])

    const sources = new Map<string, Set<string>>()
    for (const scan of singleScans) {
      if (!scan.bottleId) continue
      if (!sources.has(scan.bottleId)) sources.set(scan.bottleId, new Set())
      sources.get(scan.bottleId)!.add(sourceKey(scan))
    }

    const flagged = singleBottles.filter(
      (b) => (sources.get(b.id)?.size ?? 0) >= CLONE_MIN_SOURCES
    )
    const open = await openAlertMessages("MASS_CLONING", flagged.map((b) => b.manufacturerId))

    for (const bottle of flagged) {
      const sourceCount = sources.get(bottle.id)!.size
      checks.cloning++
      if (open.some((m) => m.includes(bottle.serialId))) continue

      const severity: AlertSeverity =
        sourceCount >= CLONE_CRITICAL
          ? "CRITICAL"
          : sourceCount >= CLONE_HIGH_CONCERN
            ? "HIGH_CONCERN"
            : "SUSPICIOUS"

      await prisma.alertLog.create({
        data: {
          type: "MASS_CLONING",
          severity,
          manufacturerId: bottle.manufacturerId,
          batchId: bottle.batchId,
          message: `Single-mode code ${bottle.serialId} was scanned from ${sourceCount} different devices or connections. Copies of this code are likely in circulation.`,
          detail: JSON.stringify({
            bottleId: bottle.id,
            serialId: bottle.serialId,
            sourceCount,
            product: bottle.batch?.product?.name,
            batchCode: bottle.batch?.batchCode,
          }),
          confidenceScore: Math.min(0.6 + (sourceCount / 20) * 0.39, 0.99),
        },
      })
      alertsCreated++
    }
  }

  // ── 3. Geographic teleportation detection ─────────────────────────────────
  // Consecutive scans of the same bottle at impossible speeds. All located
  // scans from the last 24 hours are read in one query and grouped here.

  const locatedScans = await prisma.scanLog.findMany({
    where: {
      bottleId: { not: null },
      lat: { not: null },
      lng: { not: null },
      scannedAt: { gte: since },
    },
    orderBy: { scannedAt: "asc" },
    select: {
      lat: true,
      lng: true,
      scannedAt: true,
      bottleId: true,
      region: true,
      bottle: { select: { serialId: true, manufacturerId: true } },
    },
    take: MAX_SCANS_PER_RULE,
  })

  const locatedByBottle = groupBy(locatedScans, (s) => s.bottleId)
  const teleports: {
    bottleId: string
    serialId: string
    manufacturerId: string
    prev: (typeof locatedScans)[number]
    curr: (typeof locatedScans)[number]
    distKm: number
    hoursElapsed: number
    speedKmh: number
  }[] = []

  for (const [bottleId, scans] of locatedByBottle) {
    for (let i = 1; i < scans.length; i++) {
      const prev = scans[i - 1]
      const curr = scans[i]
      if (prev.lat == null || prev.lng == null || curr.lat == null || curr.lng == null) continue
      if (!curr.bottle) continue

      const distKm = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng)
      if (distKm < TELEPORT_MIN_DISTANCE_KM) continue
      const hoursElapsed =
        (curr.scannedAt.getTime() - prev.scannedAt.getTime()) / 1000 / 3600
      if (hoursElapsed <= 0) continue

      const speedKmh = distKm / hoursElapsed
      if (speedKmh > TELEPORT_SPEED_KMH) {
        teleports.push({
          bottleId,
          serialId: curr.bottle.serialId,
          manufacturerId: curr.bottle.manufacturerId,
          prev,
          curr,
          distKm,
          hoursElapsed,
          speedKmh,
        })
        break // one alert per bottle per run
      }
    }
  }

  checks.teleportation = teleports.length
  const openTeleport = await openAlertMessages(
    "GEOGRAPHIC_TELEPORTATION",
    teleports.map((t) => t.manufacturerId)
  )

  for (const t of teleports) {
    if (openTeleport.some((m) => m.includes(t.serialId))) continue
    await prisma.alertLog.create({
      data: {
        type: "GEOGRAPHIC_TELEPORTATION",
        severity: "CRITICAL",
        manufacturerId: t.manufacturerId,
        message: `Bottle ${t.serialId} scanned ${Math.round(t.distKm)}km apart in ${t.hoursElapsed.toFixed(1)} hours, too far to travel in that time`,
        detail: JSON.stringify({
          bottleId: t.bottleId,
          serialId: t.serialId,
          distanceKm: Math.round(t.distKm),
          hoursElapsed: t.hoursElapsed.toFixed(2),
          speedKmh: Math.round(t.speedKmh),
          fromRegion: t.prev.region,
          toRegion: t.curr.region,
          fromCoords: [t.prev.lat, t.prev.lng],
          toCoords: [t.curr.lat, t.curr.lng],
        }),
        lat: t.curr.lat,
        lng: t.curr.lng,
        region: t.curr.region,
        confidenceScore: Math.min(0.7 + (t.speedKmh / 2000) * 0.3, 0.99),
      },
    })
    alertsCreated++
  }

  // ── 4. Supply chain drift detection ───────────────────────────────────────
  // Batches scanned beyond DRIFT_RADIUS_KM from their target region. Only
  // batches with located scans in the last 24 hours are looked at, in one
  // query, instead of one query for every batch ever made.

  const regionScans = await prisma.scanLog.findMany({
    where: {
      batchId: { not: null },
      lat: { not: null },
      lng: { not: null },
      scannedAt: { gte: since },
      batch: { targetRegion: { not: null } },
    },
    select: {
      batchId: true,
      lat: true,
      lng: true,
      region: true,
      batch: { select: { batchCode: true, targetRegion: true, manufacturerId: true } },
    },
    take: MAX_SCANS_PER_RULE,
  })

  const drifts: {
    batchId: string
    batchCode: string
    targetRegion: string
    manufacturerId: string
    count: number
    worst: (typeof regionScans)[number]
    worstKm: number
  }[] = []

  for (const [batchId, scans] of groupBy(regionScans, (s) => s.batchId)) {
    const batch = scans[0]?.batch
    const target = regionCoords(batch?.targetRegion)
    if (!batch?.targetRegion || !target) continue

    let count = 0
    let worst = scans[0]
    let worstKm = 0
    for (const scan of scans) {
      if (scan.lat == null || scan.lng == null) continue
      const km = haversineKm(target.lat, target.lng, scan.lat, scan.lng)
      if (km <= DRIFT_RADIUS_KM) continue
      count++
      if (km > worstKm) {
        worstKm = km
        worst = scan
      }
    }
    if (count > 0) {
      drifts.push({
        batchId,
        batchCode: batch.batchCode,
        targetRegion: batch.targetRegion,
        manufacturerId: batch.manufacturerId,
        count,
        worst,
        worstKm,
      })
    }
  }

  checks.drift = drifts.length
  const openDrift = await prisma.alertLog.findMany({
    where: {
      type: "SUPPLY_CHAIN_DRIFT",
      resolved: false,
      batchId: { in: drifts.map((d) => d.batchId) },
    },
    select: { batchId: true },
  })
  const driftOpen = new Set(openDrift.map((a) => a.batchId))

  for (const d of drifts) {
    if (driftOpen.has(d.batchId)) continue
    await prisma.alertLog.create({
      data: {
        type: "SUPPLY_CHAIN_DRIFT",
        severity: "SUSPICIOUS",
        manufacturerId: d.manufacturerId,
        message: `Batch ${d.batchCode} (target: ${d.targetRegion}) scanned ${Math.round(d.worstKm)}km outside expected region`,
        detail: JSON.stringify({
          batchId: d.batchId,
          batchCode: d.batchCode,
          targetRegion: d.targetRegion,
          driftingScanCount: d.count,
          maxDriftKm: Math.round(d.worstKm),
          detectedRegion: d.worst.region,
        }),
        batchId: d.batchId,
        lat: d.worst.lat,
        lng: d.worst.lng,
        region: d.worst.region,
        confidenceScore: Math.min(0.5 + (d.count / 10) * 0.4, 0.95),
      },
    })
    alertsCreated++
  }

  // ── 5. Bot behavior detection ─────────────────────────────────────────────
  // A source scanning many codes within any 2 minute window of the last 24
  // hours (the job runs once a day, so looking only at the last 2 minutes
  // missed almost everything). A source is the anonymous device when the scan
  // has one, and separately the hashed IP with a much higher threshold.

  const daySourceScans = await prisma.scanLog.findMany({
    where: {
      OR: [{ deviceHash: { not: null } }, { ipHash: { not: null } }],
      scannedAt: { gte: since },
    },
    select: {
      deviceHash: true,
      ipHash: true,
      bottleId: true,
      scannedAt: true,
      manufacturerId: true,
    },
    orderBy: { scannedAt: "asc" },
    take: MAX_SCANS_PER_RULE,
  })

  const bySource = new Map<string, typeof daySourceScans>()
  const add = (key: string, scan: (typeof daySourceScans)[number]) => {
    const list = bySource.get(key)
    if (list) list.push(scan)
    else bySource.set(key, [scan])
  }
  for (const scan of daySourceScans) {
    if (scan.deviceHash) add(`device:${scan.deviceHash}`, scan)
    if (scan.ipHash) add(`ip:${scan.ipHash}`, scan)
  }

  const bots: {
    isIp: boolean
    sourceHash: string
    manufacturerId: string
    scanCount: number
    uniqueBottles: number
    windowStart: Date
  }[] = []

  for (const [key, scans] of bySource) {
    const isIp = key.startsWith("ip:")
    const threshold = isIp ? BOT_IP_SCAN_COUNT : BOT_SCAN_COUNT
    if (scans.length < threshold) continue

    // Busiest 2 minute window, with two pointers over the sorted scans.
    let best = 0
    let bestStart = 0
    let lo = 0
    for (let hi = 0; hi < scans.length; hi++) {
      while (scans[hi].scannedAt.getTime() - scans[lo].scannedAt.getTime() > BOT_TIME_WINDOW_MS) lo++
      if (hi - lo + 1 > best) {
        best = hi - lo + 1
        bestStart = lo
      }
    }
    if (best < threshold) continue

    const windowScans = scans.slice(bestStart, bestStart + best)
    // The manufacturer whose codes this source scanned most in that window.
    const perMfr = new Map<string, number>()
    for (const w of windowScans) perMfr.set(w.manufacturerId, (perMfr.get(w.manufacturerId) ?? 0) + 1)
    const manufacturerId = [...perMfr.entries()].sort((x, y) => y[1] - x[1])[0][0]

    bots.push({
      isIp,
      sourceHash: key.slice(key.indexOf(":") + 1).slice(0, 12),
      manufacturerId,
      scanCount: best,
      uniqueBottles: new Set(windowScans.map((w) => w.bottleId)).size,
      windowStart: windowScans[0].scannedAt,
    })
  }

  checks.bot = bots.length
  const openBot = await prisma.alertLog.findMany({
    where: {
      type: "BOT_ACTIVITY",
      resolved: false,
      createdAt: { gte: since },
      manufacturerId: { in: bots.map((b) => b.manufacturerId) },
    },
    select: { detail: true },
  })

  for (const b of bots) {
    // One open alert per source per day
    if (openBot.some((a) => a.detail?.includes(b.sourceHash))) continue
    await prisma.alertLog.create({
      data: {
        type: "BOT_ACTIVITY",
        severity: "HIGH_CONCERN",
        manufacturerId: b.manufacturerId,
        message: `${b.scanCount} scans from one ${b.isIp ? "IP address" : "device"} within 2 minutes, which suggests automated scanning`,
        detail: JSON.stringify({
          sourceType: b.isIp ? "ip" : "device",
          sourceHash: b.sourceHash,
          scanCount: b.scanCount,
          uniqueBottles: b.uniqueBottles,
          windowStart: b.windowStart.toISOString(),
          windowMs: BOT_TIME_WINDOW_MS,
        }),
        confidenceScore: Math.min(0.6 + (b.scanCount / 200) * 0.4, 0.98),
      },
    })
    alertsCreated++
  }

  // ── 6. Fraud rate recomputation ───────────────────────────────────────────

  const manufacturersUpdated = await recomputeFraudRates()
  checks.fraud_rates = manufacturersUpdated

  return {
    ran_at: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    alerts_created: alertsCreated,
    manufacturers_updated: manufacturersUpdated,
    checks,
  }
}

// ── Fast pipeline: fraud rates only ──────────────────────────────────────────
// For the manual trigger in the admin portal. The full pipeline runs from the
// daily cron.

export async function runFastFraudPipeline(): Promise<PipelineResult> {
  const startTime = Date.now()
  const manufacturersUpdated = await recomputeFraudRates()
  return {
    ran_at: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    alerts_created: 0,
    manufacturers_updated: manufacturersUpdated,
    checks: {
      velocity: 0,
      cloning: 0,
      teleportation: 0,
      drift: 0,
      bot: 0,
      fraud_rates: manufacturersUpdated,
    },
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Updates totalScans, totalFraudFlags, totalBottlesGenerated and
// fraudRateCached for every active manufacturer, with three grouped counts
// instead of three counts per manufacturer.
async function recomputeFraudRates(): Promise<number> {
  const [manufacturers, scans, flags, bottles] = await Promise.all([
    prisma.manufacturer.findMany({
      where: { onboardingStatus: "ACTIVE_PRODUCTION" },
      select: { id: true },
    }),
    prisma.scanLog.groupBy({ by: ["manufacturerId"], _count: true }),
    prisma.scanLog.groupBy({ by: ["manufacturerId"], _count: true, where: { fraudFlag: true } }),
    prisma.bottle.groupBy({ by: ["manufacturerId"], _count: true }),
  ])
  if (manufacturers.length === 0) return 0

  const toMap = (rows: { manufacturerId: string; _count: number }[]) =>
    new Map(rows.map((r) => [r.manufacturerId, r._count]))
  const scanMap = toMap(scans)
  const flagMap = toMap(flags)
  const bottleMap = toMap(bottles)

  await prisma.$transaction(
    manufacturers.map((m) => {
      const totalScans = scanMap.get(m.id) ?? 0
      const fraudScans = flagMap.get(m.id) ?? 0
      return prisma.manufacturer.update({
        where: { id: m.id },
        data: {
          totalScans,
          totalFraudFlags: fraudScans,
          totalBottlesGenerated: bottleMap.get(m.id) ?? 0,
          fraudRateCached: totalScans > 0 ? (fraudScans / totalScans) * 100 : 0,
        },
      })
    })
  )
  return manufacturers.length
}

// A scan's source: its device, else its hashed IP. A scan with neither (an
// old record, or no QR_SECRET) counts as its own source, so it is never
// merged with another scan.
function sourceKey(scan: { id: string; deviceHash: string | null; ipHash: string | null }): string {
  if (scan.deviceHash) return `device:${scan.deviceHash}`
  if (scan.ipHash) return `ip:${scan.ipHash}`
  return `scan:${scan.id}`
}

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    if (!k) continue
    const list = out.get(k)
    if (list) list.push(row)
    else out.set(k, [row])
  }
  return out
}

// Messages of the open alerts of one type for these manufacturers, read once
// so each candidate does not need its own query.
async function openAlertMessages(
  type: "REPEAT_SCAN_ABUSE" | "MASS_CLONING" | "GEOGRAPHIC_TELEPORTATION",
  manufacturerIds: string[]
): Promise<string[]> {
  if (manufacturerIds.length === 0) return []
  const rows = await prisma.alertLog.findMany({
    where: { type, resolved: false, manufacturerId: { in: [...new Set(manufacturerIds)] } },
    select: { message: true },
  })
  return rows.map((r) => r.message)
}
