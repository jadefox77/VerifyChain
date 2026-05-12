import { prisma } from "@/lib/prisma"

type VerifyInput = {
  serialId: string
  phoneHash?: string
  lat?: number
  lng?: number
}

type VerifyResult =
  | { status: "PROMPT_CAP"; message: string; productName: string; topCode: string }
  | { status: "ALREADY_OPENED"; message: string; firstScan: Date }
  | { status: "FLAGGED"; message: string }
  | { status: "NOT_FOUND"; message: string }

export async function verifyBottle(input: VerifyInput): Promise<VerifyResult> {
  const { serialId, phoneHash, lat, lng } = input

  const bottle = await prisma.bottle.findUnique({
    where: { serialId },
    include: {
      cap: true,
      batch: {
        include: { product: true },
      },
      scanLogs: {
        where: { scanLayer: "BOTTLE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!bottle) {
    return {
      status: "NOT_FOUND",
      message: "This code was not found. The product may be counterfeit.",
    }
  }

  if (bottle.status === "FLAGGED") {
    return {
      status: "FLAGGED",
      message: "This product has been flagged for fraud. Do not consume.",
    }
  }

  // Log the bottle scan
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

  if (bottle.status === "OPENED") {
    return {
      status: "ALREADY_OPENED",
      message: "This bottle has already been opened and verified.",
      firstScan: bottle.firstScannedAt!,
    }
  }

  return {
    status: "PROMPT_CAP",
    message: `Bottle identity confirmed for ${bottle.batch.product.name}. Now open the bottle and scan the hidden QR code inside the cap to complete verification.`,
    productName: bottle.batch.product.name,
    topCode: bottle.cap?.topCode ?? "",
  }
}