import { prisma } from "@/lib/prisma"

type VerifyInput = {
  serialId: string
  phoneHash?: string
  lat?: number
  lng?: number
}

type VerifyResult =
  | { status: "PROMPT_CAP"; message: string; productName: string; topCode: string }
  | { status: "ALREADY_VERIFIED"; message: string; firstScan: Date }
  | { status: "CAP_ALREADY_OPENED"; message: string; capOpenedAt: Date }
  | { status: "FLAGGED"; message: string }
  | { status: "NOT_FOUND"; message: string }

export async function verifyBottle(input: VerifyInput): Promise<VerifyResult> {
  const { serialId, phoneHash, lat, lng } = input

  const bottle = await prisma.bottle.findUnique({
    where: { serialId },
    include: {
      cap: true,
      batch: { include: { product: true } },
      scanLogs: {
        where: { scanLayer: "BOTTLE" },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!bottle) {
    return {
      status: "NOT_FOUND",
      message: "This code was not found in our system. The product may be counterfeit.",
    }
  }

  if (bottle.status === "FLAGGED") {
    return {
      status: "FLAGGED",
      message: "This product has been flagged for fraud. Do not consume.",
    }
  }

  // Log the bottle scan — no fraud flag, bottle QR scanning alone is not fraud
  await prisma.scanLog.create({
    data: {
      bottleId: bottle.id,
      phoneHash: phoneHash ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      scanCount: bottle.scanLogs.length + 1,
      scanLayer: "BOTTLE",
      fraudFlag: false,
      flagReason: null,
    },
  })

  // Cap has already been opened — this bottle may have been refilled
  if (bottle.cap && bottle.cap.status === "OPENED") {
    // Flag the bottle
    await prisma.bottle.update({
      where: { id: bottle.id },
      data: { status: "FLAGGED" },
    })

    await prisma.cap.update({
      where: { id: bottle.cap.id },
      data: { status: "FLAGGED" },
    })

    // Write a fraud scan log
    await prisma.scanLog.create({
      data: {
        bottleId: bottle.id,
        phoneHash: phoneHash ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        scanCount: bottle.scanLogs.length + 2,
        scanLayer: "BOTTLE",
        fraudFlag: true,
        flagReason: "Cap already opened before bottle QR was scanned — possible refill",
      },
    })

    return {
      status: "CAP_ALREADY_OPENED",
      message: `The hidden cap inside this bottle was already opened on ${bottle.cap.firstOpenedAt?.toLocaleDateString("en-NG", {
        timeZone: "Africa/Lagos",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}. This bottle may have been refilled. Do not consume.`,
      capOpenedAt: bottle.cap.firstOpenedAt!,
    }
  }

  // Cap has been flagged
  if (bottle.cap && bottle.cap.status === "FLAGGED") {
    return {
      status: "FLAGGED",
      message: "The cap associated with this bottle has been flagged for fraud. Do not consume.",
    }
  }

  // Bottle already fully verified
  if (bottle.status === "OPENED") {
    return {
      status: "ALREADY_VERIFIED",
      message: "This bottle has already been opened and fully verified.",
      firstScan: bottle.firstScannedAt!,
    }
  }

  // Normal flow — prompt consumer to scan cap
  return {
    status: "PROMPT_CAP",
    message: `Bottle identity confirmed for ${bottle.batch.product.name}. Now open the bottle and scan the hidden QR code inside the cap to complete verification.`,
    productName: bottle.batch.product.name,
    topCode: bottle.cap?.topCode ?? "",
  }
}