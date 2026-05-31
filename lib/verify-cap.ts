import { prisma } from "@/lib/prisma"

type CapVerifyInput = {
  hiddenSerialId: string
  bottleSerialId?: string
  lat?: number
  lng?: number
}

export type CapVerifyResult =
  | { status: "GENUINE"; message: string; productName: string; openedAt: Date }
  | { status: "WARNING"; message: string; firstOpened: Date; firstLocation: string | null }
  | { status: "FLAGGED"; message: string; reason: string }
  | { status: "MISMATCH"; message: string }
  | { status: "NOT_FOUND"; message: string }

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
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

export async function verifyCap(input: CapVerifyInput): Promise<CapVerifyResult> {
  const { hiddenSerialId, bottleSerialId, lat, lng } = input

  const cap = await prisma.cap.findUnique({
    where: { hiddenSerialId },
    include: {
      bottle: {
        include: {
          batch: { include: { product: true } },
          scanLogs: {
            where: { scanLayer: "CAP" },
            orderBy: { scannedAt: "asc" },
          },
        },
      },
    },
  })

  if (!cap) {
    return {
      status: "NOT_FOUND",
      message: "This cap code was not found. The product may be counterfeit.",
    }
  }

  if (!cap.bottle) {
  return {
    status: "FLAGGED",
    message: "This cap has not been paired to a bottle yet.",
    reason: "UNPAIRED_CAP",
  }
}

  // Pairing check
  if (bottleSerialId && cap.bottle.serialId !== bottleSerialId) {
    await prisma.scanLog.create({
      data: {
        capId: cap.id,
        bottleId: cap.bottleId,
        manufacturerId: cap.bottle.manufacturerId,
        batchId: cap.bottle.batchId,
        lat: lat ?? null,
        lng: lng ?? null,
        scanLayer: "CAP",
        fraudFlag: true,
        flagReason: "Cap and bottle identity mismatch",
      },
    })

    await prisma.cap.update({
      where: { id: cap.id },
      data: { status: "FLAGGED" },
    })

    await prisma.bottle.update({
      where: { id: cap.bottleId! },
      data: { status: "FLAGGED" },
    })

    return {
      status: "MISMATCH",
      message: "The cap does not match this bottle. The bottle may have been refilled. Do not consume.",
    }
  }

  let fraudFlag = false
  let flagReason: string | null = null

  // Fraud rule 1: already opened
  if (cap.status !== "SEALED") {
    fraudFlag = true
    flagReason = "Cap already opened"
  }

  // Fraud rule 2: supply chain drift
  if (lat && lng && cap.bottle.batch.targetRegion) {
    const regionCoords: Record<string, { lat: number; lng: number }> = {
      Lagos:    { lat: 6.5244,  lng: 3.3792 },
      Abuja:    { lat: 9.0765,  lng: 7.3986 },
      Kano:     { lat: 12.0022, lng: 8.5920 },
      Rivers:   { lat: 4.8156,  lng: 7.0498 },
      Oyo:      { lat: 7.3775,  lng: 3.9470 },
      Edo:      { lat: 6.3350,  lng: 5.6037 },
      Anambra:  { lat: 6.2104,  lng: 6.9623 },
      Kaduna:   { lat: 10.5264, lng: 7.4384 },
      Delta:    { lat: 5.5329,  lng: 5.8987 },
    }

    const targetCoords = regionCoords[cap.bottle.batch.targetRegion]
    if (targetCoords) {
      const driftKm = haversineKm(targetCoords.lat, targetCoords.lng, lat, lng)
      if (driftKm > 300) {
        fraudFlag = true
        flagReason = `Supply chain drift: batch intended for ${cap.bottle.batch.targetRegion} but scanned ${Math.round(driftKm)}km away`
      }
    }
  }

  // Write scan log
  await prisma.scanLog.create({
    data: {
      capId: cap.id,
      bottleId: cap.bottleId!,
      manufacturerId: cap.bottle.manufacturerId,
      batchId: cap.bottle.batchId,
      lat: lat ?? null,
      lng: lng ?? null,
      scanLayer: "CAP",
      fraudFlag,
      flagReason,
    },
  })

  // Update cap status on first open
  if (cap.status === "SEALED") {
    await prisma.cap.update({
      where: { id: cap.id },
      data: {
        status: fraudFlag ? "FLAGGED" : "OPENED",
        openedAt: new Date(),
      },
    })
  } else if (fraudFlag && cap.status !== "FLAGGED") {
    await prisma.cap.update({
      where: { id: cap.id },
      data: { status: "FLAGGED" },
    })
  }

  // Update bottle status
  if (cap.bottle.status === "MINT") {
    await prisma.bottle.update({
      where: { id: cap.bottleId! },
      data: { status: fraudFlag ? "FLAGGED" : "OPENED" },
    })
  }

  if (fraudFlag) {
    if (cap.status !== "SEALED") {
      return {
        status: "WARNING",
        message: "This cap was already opened previously.",
        firstOpened: cap.openedAt ?? new Date(),
        firstLocation: null,
      }
    }
    return {
      status: "FLAGGED",
      message: `Fraud detected. ${flagReason}`,
      reason: flagReason!,
    }
  }

  return {
    status: "GENUINE",
    message: `Genuine ${cap.bottle.batch.product?.name ?? "Unknown Product"}. First opening confirmed. Safe to consume.`,
    productName: cap.bottle.batch.product?.name ?? "Unknown Product",
    openedAt: new Date(),
  }
}