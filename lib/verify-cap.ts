import { prisma } from "@/lib/prisma"
import crypto from "crypto"

type CapVerifyInput = {
  hiddenSerialId: string
  bottleSerialId?: string
  phoneHash?: string
  lat?: number
  lng?: number
}

type CapVerifyResult =
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
  const { hiddenSerialId, bottleSerialId, phoneHash, lat, lng } = input

  const cap = await prisma.cap.findUnique({
    where: { hiddenSerialId },
    include: {
      bottle: {
        include: {
          batch: {
            include: { product: true },
          },
          scanLogs: {
            where: { scanLayer: "CAP" },
            orderBy: { createdAt: "asc" },
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

  // --- Pairing check ---
  // If the consumer also scanned the bottle QR first, verify they match
  if (bottleSerialId && cap.bottle.serialId !== bottleSerialId) {
    await prisma.scanLog.create({
      data: {
        capId: cap.id,
        bottleId: cap.bottleId,
        phoneHash: phoneHash ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        scanCount: 1,
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
      where: { id: cap.bottleId },
      data: { status: "FLAGGED" },
    })

    return {
      status: "MISMATCH",
      message:
        "The cap does not match this bottle. The bottle may have been refilled with a different cap. Do not consume.",
    }
  }

  const scanCount = cap.bottle.scanLogs.length + 1
  let fraudFlag = false
  let flagReason: string | null = null

  // --- Fraud rule 1: already opened ---
  if (cap.status !== "SEALED") {
    fraudFlag = true
    flagReason = "Cap already opened"
  }

  // --- Fraud rule 2: teleportation ---
  if (lat && lng && cap.firstOpenedLat && cap.firstOpenedLng) {
    const distanceKm = haversineKm(
      cap.firstOpenedLat, cap.firstOpenedLng, lat, lng
    )
    const hoursElapsed =
      (Date.now() - cap.firstOpenedAt!.getTime()) / 1000 / 3600

    if (hoursElapsed > 0 && distanceKm / hoursElapsed > 500) {
      fraudFlag = true
      flagReason = `Impossible location: ${Math.round(distanceKm)}km in ${hoursElapsed.toFixed(1)}hrs`
    }
  }

  // --- Fraud rule 3: supply chain drift ---
  if (lat && lng && cap.bottle.batch.targetRegion) {
    const regionCoords: Record<string, { lat: number; lng: number }> = {
      Lagos: { lat: 6.5244, lng: 3.3792 },
      Abuja: { lat: 9.0765, lng: 7.3986 },
      Kano: { lat: 12.0022, lng: 8.5920 },
      Rivers: { lat: 4.8156, lng: 7.0498 },
      Oyo: { lat: 7.3775, lng: 3.9470 },
      Edo: { lat: 6.3350, lng: 5.6037 },
      Anambra: { lat: 6.2104, lng: 6.9623 },
      Kaduna: { lat: 10.5264, lng: 7.4384 },
      Delta: { lat: 5.5329, lng: 5.8987 },
    }

    const targetCoords = regionCoords[cap.bottle.batch.targetRegion]
    if (targetCoords) {
      const driftKm = haversineKm(
        targetCoords.lat, targetCoords.lng, lat, lng
      )
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
      bottleId: cap.bottleId,
      phoneHash: phoneHash ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      scanCount,
      scanLayer: "CAP",
      fraudFlag,
      flagReason,
    },
  })

  // Update cap status
  if (cap.status === "SEALED") {
    await prisma.cap.update({
      where: { id: cap.id },
      data: {
        status: fraudFlag ? "FLAGGED" : "OPENED",
        firstOpenedAt: new Date(),
        firstOpenedLat: lat ?? null,
        firstOpenedLng: lng ?? null,
        firstPhoneHash: phoneHash ?? null,
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
      where: { id: cap.bottleId },
      data: {
        status: fraudFlag ? "FLAGGED" : "OPENED",
        firstScannedAt: new Date(),
        firstScannedLat: lat ?? null,
        firstScannedLng: lng ?? null,
        firstPhoneHash: phoneHash ?? null,
      },
    })
  }

  const firstLocation =
    cap.firstOpenedLat && cap.firstOpenedLng
      ? `${cap.firstOpenedLat.toFixed(2)}, ${cap.firstOpenedLng.toFixed(2)}`
      : null

  if (fraudFlag) {
    if (cap.status !== "SEALED") {
      return {
        status: "WARNING",
        message: `This cap was already opened previously.`,
        firstOpened: cap.firstOpenedAt!,
        firstLocation,
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
    message: `Genuine ${cap.bottle.batch.product.name}. First opening confirmed. Safe to consume.`,
    productName: cap.bottle.batch.product.name,
    openedAt: new Date(),
  }
}