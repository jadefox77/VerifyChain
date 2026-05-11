import { prisma } from "@/lib/prisma"

type VerifyInput = {
  serialId: string
  phoneHash?: string
  lat?: number
  lng?: number
}

type VerifyResult =
  | { status: "GENUINE"; message: string; firstScan: Date }
  | { status: "WARNING"; message: string; firstScan: Date; firstLocation: string | null }
  | { status: "FLAGGED"; message: string; firstScan: Date; firstLocation: string | null }
  | { status: "NOT_FOUND"; message: string }

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

export async function verifyBottle(input: VerifyInput): Promise<VerifyResult> {
  const { serialId, phoneHash, lat, lng } = input

  const bottle = await prisma.bottle.findUnique({
    where: { serialId },
    include: {
      scanLogs: {
        orderBy: { createdAt: "asc" },
      },
      batch: {
        include: { product: true },
      },
    },
  })

  if (!bottle) {
    return {
      status: "NOT_FOUND",
      message:
        "This code was not found in our system. This product may be counterfeit.",
    }
  }

  const scanCount = bottle.scanLogs.length + 1
  let fraudFlag = false
  let flagReason: string | null = null

  // --- Fraud rule 1: already opened ---
  if (bottle.status !== "MINT") {
    fraudFlag = true
    flagReason = "Duplicate scan detected"
  }

  // --- Fraud rule 2: teleportation check ---
  if (lat && lng && bottle.firstScannedLat && bottle.firstScannedLng) {
    const distanceKm = haversineKm(
      bottle.firstScannedLat,
      bottle.firstScannedLng,
      lat,
      lng
    )
    const firstScanTime = bottle.firstScannedAt!
    const hoursElapsed =
      (Date.now() - firstScanTime.getTime()) / 1000 / 3600

    if (hoursElapsed > 0) {
      const impliedSpeedKmh = distanceKm / hoursElapsed
      if (impliedSpeedKmh > 500) {
        fraudFlag = true
        flagReason = `Impossible location jump: ${Math.round(distanceKm)}km in ${hoursElapsed.toFixed(1)}hrs`
      }
    }
  }

  // --- Fraud rule 3: cluster detection ---
  const distinctCities = new Set(
    bottle.scanLogs
      .map((s) => s.city)
      .filter(Boolean)
  )
  if (distinctCities.size >= 3) {
    fraudFlag = true
    flagReason = `Scanned in ${distinctCities.size} distinct cities`
  }

  // Write the scan log
  await prisma.scanLog.create({
    data: {
      bottleId: bottle.id,
      phoneHash: phoneHash ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      scanCount,
      fraudFlag,
      flagReason,
    },
  })

  // Update bottle status
  if (bottle.status === "MINT") {
    await prisma.bottle.update({
      where: { id: bottle.id },
      data: {
        status: fraudFlag ? "FLAGGED" : "OPENED",
        firstScannedAt: new Date(),
        firstScannedLat: lat ?? null,
        firstScannedLng: lng ?? null,
        firstPhoneHash: phoneHash ?? null,
      },
    })
  } else if (fraudFlag && bottle.status !== "FLAGGED") {
    await prisma.bottle.update({
      where: { id: bottle.id },
      data: { status: "FLAGGED" },
    })
  }

  const firstLocation =
    bottle.firstScannedLat && bottle.firstScannedLng
      ? `${bottle.firstScannedLat.toFixed(2)}, ${bottle.firstScannedLng.toFixed(2)}`
      : null

  // --- Return result ---
  if (bottle.status === "MINT" && !fraudFlag) {
    return {
      status: "GENUINE",
      message: `Genuine ${bottle.batch.product.name}. Safe to consume.`,
      firstScan: new Date(),
    }
  }

  if (fraudFlag && (bottle.status === "FLAGGED" || distinctCities.size >= 3)) {
    return {
      status: "FLAGGED",
      message: `This product has been flagged for fraud. Do not consume. Reason: ${flagReason}`,
      firstScan: bottle.firstScannedAt!,
      firstLocation,
    }
  }

  return {
    status: "WARNING",
    message: `This bottle was already opened. First scanned on ${bottle.firstScannedAt?.toLocaleDateString("en-NG")}. Possible refill detected.`,
    firstScan: bottle.firstScannedAt!,
    firstLocation,
  }
}