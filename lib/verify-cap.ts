import { prisma } from "@/lib/prisma"

export type ScanMeta = {
  channel?: string | null
  ipHash?: string | null
  userAgent?: string | null
}

type CapVerifyInput = {
  hiddenSerialId: string
  // The bottle the consumer actually scanned (from the verification cookie).
  // When absent, the cap can still be verified, but refills cannot be caught.
  bottleSerialId?: string
  lat?: number
  lng?: number
  meta?: ScanMeta
}

export type CapVerifyResult =
  | { status: "GENUINE"; message: string; productName: string; openedAt: Date; pairingChecked: boolean }
  | { status: "WARNING"; message: string; firstOpened: Date; firstLocation: string | null }
  | { status: "FLAGGED"; message: string; reason: string }
  | { status: "MISMATCH"; message: string }
  | { status: "NOT_FOUND"; message: string }

const DRIFT_RADIUS_KM = 300

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
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function hasCoords(lat?: number, lng?: number): lat is number {
  return typeof lat === "number" && typeof lng === "number"
}

export async function verifyCap(input: CapVerifyInput): Promise<CapVerifyResult> {
  const { hiddenSerialId, bottleSerialId, lat, lng, meta } = input

  const cap = await prisma.cap.findUnique({
    where: { hiddenSerialId },
    include: {
      bottle: {
        include: { batch: { include: { product: true } } },
      },
    },
  })

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
        userAgent: meta?.userAgent ?? null,
      },
    })

  // Pairing check: the cap must belong to the bottle that was scanned
  if (bottleSerialId && bottle.serialId !== bottleSerialId) {
    await logScan(true, "Cap and bottle identity mismatch")
    await prisma.cap.update({ where: { id: cap.id }, data: { status: "FLAGGED" } })
    await prisma.bottle.update({ where: { id: bottleId }, data: { status: "FLAGGED" } })
    return {
      status: "MISMATCH",
      message:
        "This cap does not belong to the bottle you scanned. The bottle may have been refilled. Do not consume it.",
    }
  }

  // Supply chain drift
  let driftReason: string | null = null
  const target = bottle.batch.targetRegion
  if (hasCoords(lat, lng) && target && REGION_COORDS[target]) {
    const t = REGION_COORDS[target]
    const driftKm = haversineKm(t.lat, t.lng, lat, lng!)
    if (driftKm > DRIFT_RADIUS_KM) {
      driftReason = `Supply chain drift: batch intended for ${target} but scanned ${Math.round(driftKm)}km away`
    }
  }

  // Atomic first-open claim
  // Only one request can move the cap out of SEALED. If two people scan the
  // same cap at the same moment, the second one sees count === 0.
  const now = new Date()
  const claim = await prisma.cap.updateMany({
    where: { id: cap.id, status: "SEALED" },
    data: { status: driftReason ? "FLAGGED" : "OPENED", openedAt: now },
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

  await logScan(Boolean(driftReason), driftReason)
  await prisma.bottle.updateMany({
    where: { id: bottleId, status: "MINT" },
    data: { status: driftReason ? "FLAGGED" : "OPENED" },
  })

  if (driftReason) {
    return {
      status: "FLAGGED",
      message:
        "This product was scanned far from the area it was supplied to, so it has been flagged for review. Check with the seller before you consume it.",
      reason: driftReason,
    }
  }

  const productName = bottle.batch.product?.name ?? "Unknown Product"
  return {
    status: "GENUINE",
    message: `This ${productName} is genuine. This is the first time the cap has been opened.`,
    productName,
    openedAt: now,
    pairingChecked: Boolean(bottleSerialId),
  }
}
