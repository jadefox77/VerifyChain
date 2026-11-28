import type { Prisma } from "@prisma/client"
import {
  DRIFT_HARD_FLAG_BOTTLES,
  DRIFT_RADIUS_KM,
  DRIFT_WINDOW_DAYS,
  haversineKm,
  regionCoords,
} from "@/lib/regions"
import { prisma } from "@/lib/prisma"

export type ScanMeta = {
  channel?: string | null
  ipHash?: string | null
  // Keyed hash of the anonymous device cookie (web scans only)
  deviceHash?: string | null
  userAgent?: string | null
  // Verification API key that made the request, if any
  apiKeyId?: string | null
}

type CapVerifyInput = {
  hiddenSerialId: string
  // The bottles the consumer actually scanned in the last few minutes (from
  // the verification cookie), or a single id from an API caller. The cap
  // must belong to one of them. When absent, the cap can still be verified,
  // but refills cannot be caught.
  bottleSerialIds?: string[]
  lat?: number
  lng?: number
  meta?: ScanMeta
}

export type CapVerifyResult =
  | {
      status: "GENUINE"
      message: string
      productName: string
      openedAt: Date
      pairingChecked: boolean
      // Opened more than DRIFT_RADIUS_KM from the batch's target state. The
      // product still passes; the drift is recorded and the brand is alerted.
      outsideRegion: boolean
    }
  | { status: "WARNING"; message: string; firstOpened: Date; firstLocation: string | null }
  | { status: "FLAGGED"; message: string; reason: string }
  // The cap is left sealed. retry is true the first time, when the shopper is
  // asked to scan the label of the bottle they actually opened.
  | { status: "MISMATCH"; message: string; retry: boolean }
  | { status: "NOT_FOUND"; message: string }

// ── Thresholds ────────────────────────────────────────────────────────────────

// A second mismatch on the same cap from the same phone (or IP, or API key)
// within this window means the retry did not help.
export const MISMATCH_REPEAT_WINDOW_MS = 30 * 60 * 1000

const MISMATCH_REASON = "Cap and bottle identity mismatch"
const DRIFT_PREFIX = "Supply chain drift"

function hasCoords(lat?: number, lng?: number): lat is number {
  return typeof lat === "number" && typeof lng === "number"
}

export async function verifyCap(input: CapVerifyInput): Promise<CapVerifyResult> {
  return (await verifyCapDetailed(input)).result
}

// Same as verifyCap, and also says which bottle the cap belongs to, so the
// caller can drop that bottle from its list of recent scans.
export async function verifyCapDetailed(
  input: CapVerifyInput
): Promise<{ result: CapVerifyResult; capBottleSerialId: string | null }> {
  const cap = await prisma.cap.findUnique({
    where: { hiddenSerialId: input.hiddenSerialId },
    include: {
      bottle: {
        include: { batch: { include: { product: true } } },
      },
    },
  })
  const result = await checkCap(input, cap)
  return { result, capBottleSerialId: cap?.bottle?.serialId ?? null }
}

type CapWithBottle = Prisma.CapGetPayload<{
  include: { bottle: { include: { batch: { include: { product: true } } } } }
}>

async function checkCap(
  input: CapVerifyInput,
  cap: CapWithBottle | null
): Promise<CapVerifyResult> {
  const { bottleSerialIds, lat, lng, meta } = input
  const scanned = (bottleSerialIds ?? []).filter(Boolean)

  if (!cap) {
    return {
      status: "NOT_FOUND",
      message: "We could not find this cap code in our records. The product may not be genuine.",
    }
  }

  if (!cap.bottle || !cap.bottleId) {
    return {
      status: "FLAGGED",
      message:
        "This cap has not been linked to a bottle at the factory yet, so it cannot be checked. If you bought the product sealed, contact the manufacturer.",
      reason: "UNPAIRED_CAP",
    }
  }

  const bottle = cap.bottle
  const bottleId = cap.bottleId

  const logScan = (fraudFlag: boolean, flagReason: string | null) =>
    prisma.scanLog.create({
      data: {
        capId: cap.id,
        bottleId,
        manufacturerId: bottle.manufacturerId,
        batchId: bottle.batchId,
        lat: lat ?? null,
        lng: lng ?? null,
        scanLayer: "CAP",
        fraudFlag,
        flagReason,
        channel: meta?.channel ?? null,
        ipHash: meta?.ipHash ?? null,
        deviceHash: meta?.deviceHash ?? null,
        userAgent: meta?.userAgent ?? null,
        apiKeyId: meta?.apiKeyId ?? null,
      },
    })

  // Pairing check: the cap must belong to one of the bottles that was scanned.
  // An honest shopper may have scanned a shelf label and then opened a
  // different bottle, so nothing is marked as opened or flagged here. The cap
  // stays sealed, the shopper is asked to scan the bottle they opened, and the
  // brand gets an alert. A real refill cannot pass this way, because the cap
  // only ever matches its own bottle's label.
  if (scanned.length > 0 && !scanned.includes(bottle.serialId)) {
    const repeat = await isRepeatMismatch(cap.id, meta)
    await logScan(repeat, repeat ? `${MISMATCH_REASON} (again after retry)` : `${MISMATCH_REASON} (retry offered)`)
    await recordMismatchAlert({
      capId: cap.id,
      bottleSerialId: bottle.serialId,
      scannedSerialIds: scanned,
      batchId: bottle.batchId,
      batchCode: bottle.batch.batchCode,
      manufacturerId: bottle.manufacturerId,
      repeat,
      lat,
      lng,
    })
    return repeat
      ? {
          status: "MISMATCH",
          retry: false,
          message:
            "This cap still does not match the bottle label you scanned. If the label and this cap are on the same bottle, the cap may have come from another bottle and the product may have been refilled. Do not consume it, and keep the pack.",
        }
      : {
          status: "MISMATCH",
          retry: true,
          message:
            "This cap does not match the bottle label you scanned. If you opened a different bottle, scan the label on the bottle you opened, then scan this cap again. Nothing has been marked as opened yet.",
        }
  }

  // Supply chain drift: opened far from the batch's target state. Phone
  // location is approximate and distributors move stock between states, so
  // one drift is recorded and reported, not held against the product.
  let driftReason: string | null = null
  let driftKm = 0
  const target = bottle.batch.targetRegion
  const t = regionCoords(target)
  if (hasCoords(lat, lng) && target && t) {
    driftKm = haversineKm(t.lat, t.lng, lat, lng!)
    if (driftKm > DRIFT_RADIUS_KM) {
      driftReason = `${DRIFT_PREFIX}: batch intended for ${target} but scanned ${Math.round(driftKm)}km away`
    }
  }
  const hardDrift = driftReason ? await isRepeatedDrift(bottle.batchId, bottleId) : false

  // Atomic first-open claim
  // Only one request can move the cap out of SEALED. If two people scan the
  // same cap at the same moment, the second one sees count === 0.
  const now = new Date()
  const claim = await prisma.cap.updateMany({
    where: { id: cap.id, status: "SEALED" },
    data: { status: hardDrift ? "FLAGGED" : "OPENED", openedAt: now },
  })
  const firstOpen = claim.count === 1

  if (!firstOpen) {
    // Already opened before (or by a concurrent scan a moment ago)
    const reason = "Cap already opened"
    await logScan(true, driftReason ? `${reason}; ${driftReason}` : reason)
    await prisma.cap.updateMany({
      where: { id: cap.id, status: { not: "FLAGGED" } },
      data: { status: "FLAGGED" },
    })
    const fresh = await prisma.cap.findUnique({
      where: { id: cap.id },
      select: { openedAt: true },
    })
    return {
      status: "WARNING",
      message:
        "This cap has already been opened and scanned. If you have just opened the product yourself, it may have been refilled.",
      firstOpened: fresh?.openedAt ?? cap.openedAt ?? now,
      firstLocation: null,
    }
  }

  // A soft drift is logged with its reason but is not a fraud flag, so it
  // does not count toward the brand's fraud rate.
  await logScan(hardDrift, driftReason ? (hardDrift ? `${driftReason} (repeated drift)` : driftReason) : null)
  await prisma.bottle.updateMany({
    where: { id: bottleId, status: "MINT" },
    data: { status: hardDrift ? "FLAGGED" : "OPENED" },
  })

  if (driftReason && target) {
    await recordDriftAlert({
      batchId: bottle.batchId,
      batchCode: bottle.batch.batchCode,
      targetRegion: target,
      manufacturerId: bottle.manufacturerId,
      driftKm,
      hard: hardDrift,
      lat: lat!,
      lng: lng!,
    })
  }

  if (driftReason && hardDrift) {
    return {
      status: "FLAGGED",
      message:
        "Many products from this batch have been scanned far from the area they were supplied to, so this one has been flagged for review. Check with the seller before you consume it.",
      reason: driftReason,
    }
  }

  const productName = bottle.batch.product?.name ?? "Unknown Product"
  return {
    status: "GENUINE",
    message: `This ${productName} is genuine. This is the first time the cap has been opened.`,
    productName,
    openedAt: now,
    pairingChecked: scanned.length > 0,
    outsideRegion: Boolean(driftReason),
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Has this same source already had a mismatch on this cap recently?
async function isRepeatMismatch(capId: string, meta?: ScanMeta): Promise<boolean> {
  const source = meta?.deviceHash
    ? { deviceHash: meta.deviceHash }
    : meta?.ipHash
      ? { ipHash: meta.ipHash }
      : meta?.apiKeyId
        ? { apiKeyId: meta.apiKeyId }
        : null
  if (!source) return false
  const prior = await prisma.scanLog.findFirst({
    where: {
      capId,
      ...source,
      flagReason: { startsWith: MISMATCH_REASON },
      scannedAt: { gte: new Date(Date.now() - MISMATCH_REPEAT_WINDOW_MS) },
    },
    select: { id: true },
  })
  return prior !== null
}

// Has this batch already been opened out of region by enough other bottles
// to count as a pattern? Counts since the batch's last resolved drift alert,
// so once VerifyChain staff mark a movement as known, it starts again.
async function isRepeatedDrift(batchId: string, bottleId: string): Promise<boolean> {
  let since = new Date(Date.now() - DRIFT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const lastResolved = await prisma.alertLog.findFirst({
    where: { type: "SUPPLY_CHAIN_DRIFT", batchId, resolved: true, resolvedAt: { not: null } },
    orderBy: { resolvedAt: "desc" },
    select: { resolvedAt: true },
  })
  if (lastResolved?.resolvedAt && lastResolved.resolvedAt > since) since = lastResolved.resolvedAt

  const others = await prisma.scanLog.findMany({
    where: {
      batchId,
      scanLayer: "CAP",
      bottleId: { not: bottleId },
      flagReason: { startsWith: DRIFT_PREFIX },
      scannedAt: { gte: since },
    },
    distinct: ["bottleId"],
    select: { bottleId: true },
    take: DRIFT_HARD_FLAG_BOTTLES,
  })
  // This bottle would be one more than the threshold
  return others.length >= DRIFT_HARD_FLAG_BOTTLES
}

// Alerts are written straight away, so the brand sees them without waiting
// for the nightly job. A failed write never changes the shopper's result.

async function recordMismatchAlert(a: {
  capId: string
  bottleSerialId: string
  scannedSerialIds: string[]
  batchId: string
  batchCode: string
  manufacturerId: string
  repeat: boolean
  lat?: number
  lng?: number
}) {
  try {
    const open = await prisma.alertLog.findFirst({
      where: { type: "INVALID_PAIRING", resolved: false, batchId: a.batchId, detail: { contains: a.capId } },
      select: { id: true, affectedCount: true, severity: true },
    })
    if (open) {
      await prisma.alertLog.update({
        where: { id: open.id },
        data: {
          affectedCount: (open.affectedCount ?? 1) + 1,
          ...(a.repeat && open.severity === "SUSPICIOUS" ? { severity: "HIGH_CONCERN" as const } : {}),
        },
      })
      return
    }
    await prisma.alertLog.create({
      data: {
        type: "INVALID_PAIRING",
        severity: a.repeat ? "HIGH_CONCERN" : "SUSPICIOUS",
        manufacturerId: a.manufacturerId,
        batchId: a.batchId,
        affectedCount: 1,
        message: `A cap from bottle ${a.bottleSerialId} (batch ${a.batchCode}) was scanned with a different bottle's label. The cap was left sealed and the shopper was asked to scan the bottle they opened.`,
        detail: JSON.stringify({
          capId: a.capId,
          capBottleSerialId: a.bottleSerialId,
          scannedBottleSerialIds: a.scannedSerialIds.slice(0, 10),
          repeatedAfterRetry: a.repeat,
        }),
        lat: a.lat ?? null,
        lng: a.lng ?? null,
        confidenceScore: a.repeat ? 0.8 : 0.4,
      },
    })
  } catch (error) {
    console.error("Mismatch alert write failed:", error)
  }
}

async function recordDriftAlert(a: {
  batchId: string
  batchCode: string
  targetRegion: string
  manufacturerId: string
  driftKm: number
  hard: boolean
  lat: number
  lng: number
}) {
  try {
    // One open drift alert per batch, the same rule the nightly job uses.
    const open = await prisma.alertLog.findFirst({
      where: { type: "SUPPLY_CHAIN_DRIFT", resolved: false, batchId: a.batchId },
      select: { id: true, affectedCount: true, severity: true },
    })
    if (open) {
      await prisma.alertLog.update({
        where: { id: open.id },
        data: {
          affectedCount: (open.affectedCount ?? 1) + 1,
          ...(a.hard && open.severity === "SUSPICIOUS" ? { severity: "HIGH_CONCERN" as const } : {}),
        },
      })
      return
    }
    await prisma.alertLog.create({
      data: {
        type: "SUPPLY_CHAIN_DRIFT",
        severity: a.hard ? "HIGH_CONCERN" : "SUSPICIOUS",
        manufacturerId: a.manufacturerId,
        batchId: a.batchId,
        affectedCount: 1,
        message: `Batch ${a.batchCode} (target: ${a.targetRegion}) opened ${Math.round(a.driftKm)}km outside expected region`,
        detail: JSON.stringify({
          batchId: a.batchId,
          batchCode: a.batchCode,
          targetRegion: a.targetRegion,
          driftKm: Math.round(a.driftKm),
          source: "cap_scan",
        }),
        lat: a.lat,
        lng: a.lng,
        confidenceScore: a.hard ? 0.8 : 0.5,
      },
    })
  } catch (error) {
    console.error("Drift alert write failed:", error)
  }
}
