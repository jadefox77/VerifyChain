import { prisma } from "@/lib/prisma"
import type { ScanMeta } from "@/lib/verify-cap"

type VerifyInput = {
  serialId: string
  lat?: number
  lng?: number
  meta?: ScanMeta
}

export type VerifyResult =
  | {
      status: "PROMPT_CAP"
      message: string
      productName: string
      topCode: string
      authMode: "PAIRED"
    }
  | {
      status: "GENUINE_SINGLE"
      message: string
      productName: string
      authMode: "SINGLE"
      openedAt: Date
    }
  | {
      status: "ALREADY_VERIFIED"
      message: string
      firstScan: Date
      authMode: "PAIRED" | "SINGLE"
    }
  | {
      status: "CAP_ALREADY_OPENED"
      message: string
      capOpenedAt: Date
      authMode: "PAIRED"
    }
  | { status: "FLAGGED"; message: string }
  | { status: "NOT_FOUND"; message: string }

export async function verifyBottle(
  input: VerifyInput
): Promise<VerifyResult> {
  const { serialId, lat, lng, meta } = input

  const bottle = await prisma.bottle.findUnique({
    where: { serialId },
    include: {
      cap: true,
      batch: {
        include: {
          product: true,
        },
      },
      scanLogs: {
        where: { scanLayer: "BOTTLE" },
        orderBy: { scannedAt: "asc" },
      },
    },
  })

  if (!bottle) {
    return {
      status: "NOT_FOUND",
      message:
        "This code was not found in our system. The product may be counterfeit.",
    }
  }

  if (bottle.status === "FLAGGED") {
    return {
      status: "FLAGGED",
      message:
        "This product has been flagged for fraud. Do not consume.",
    }
  }

  const authMode = bottle.batch.product?.authMode ?? "PAIRED"

  // Log the bottle scan
  await prisma.scanLog.create({
    data: {
      bottleId: bottle.id,
      manufacturerId: bottle.manufacturerId,
      batchId: bottle.batchId,
      lat: lat ?? null,
      lng: lng ?? null,
      scanLayer: "BOTTLE",
      fraudFlag: false,
      flagReason: null,
      channel: meta?.channel ?? null,
      ipHash: meta?.ipHash ?? null,
      userAgent: meta?.userAgent ?? null,
    },
  })

  // ── SINGLE MODE ───────────────────────────────────────────────────────────
  // No cap required — verify immediately on first scan

  if (authMode === "SINGLE") {
    // Atomic claim: only one scan can move the unit out of MINT, so two
    // simultaneous scans cannot both be told the product is genuine.
    const claim = await prisma.bottle.updateMany({
      where: { id: bottle.id, status: "MINT" },
      data: { status: "OPENED" },
    })

    if (claim.count === 0) {
      return {
        status: "ALREADY_VERIFIED",
        message:
          "This product has already been scanned and verified previously.",
        firstScan: bottle.updatedAt,
        authMode: "SINGLE",
      }
    }

    return {
      status: "GENUINE_SINGLE",
      message: `Genuine ${
        bottle.batch.product?.name ?? "product"
      }. This unit is verified authentic. Safe to consume.`,
      productName: bottle.batch.product?.name ?? "Unknown Product",
      authMode: "SINGLE",
      openedAt: new Date(),
    }
  }

  // ── PAIRED MODE ───────────────────────────────────────────────────────────

  // Cap already opened before bottle scan — possible refill
  if (bottle.cap && bottle.cap.status === "OPENED") {
    await prisma.bottle.update({
      where: { id: bottle.id },
      data: { status: "FLAGGED" },
    })

    await prisma.cap.update({
      where: { id: bottle.cap.id },
      data: { status: "FLAGGED" },
    })

    await prisma.scanLog.create({
      data: {
        bottleId: bottle.id,
        manufacturerId: bottle.manufacturerId,
        batchId: bottle.batchId,
        lat: lat ?? null,
        lng: lng ?? null,
        scanLayer: "BOTTLE",
        fraudFlag: true,
        flagReason:
          "Cap already opened before bottle QR scanned — possible refill",
        channel: meta?.channel ?? null,
        ipHash: meta?.ipHash ?? null,
        userAgent: meta?.userAgent ?? null,
      },
    })

    return {
      status: "CAP_ALREADY_OPENED",
      message: `The hidden cap inside this bottle was already opened. This bottle may have been refilled. Do not consume.`,
      capOpenedAt: bottle.cap.openedAt ?? new Date(),
      authMode: "PAIRED",
    }
  }

  // Cap flagged
  if (bottle.cap && bottle.cap.status === "FLAGGED") {
    return {
      status: "FLAGGED",
      message:
        "The cap associated with this bottle has been flagged for fraud. Do not consume.",
    }
  }

  // Already fully verified
  if (bottle.status === "OPENED") {
    return {
      status: "ALREADY_VERIFIED",
      message:
        "This bottle has already been opened and fully verified.",
      firstScan: bottle.updatedAt,
      authMode: "PAIRED",
    }
  }

  // Unpaired bottle — cap not yet assigned on production line
if (!bottle.cap && bottle.batch.generationMode === "UNPAIRED") {
  return {
    status: "FLAGGED",
    message:
      "This bottle has not yet been paired with a cap on the production line. If you purchased this product sealed please contact the manufacturer.",
  }
}

  // Normal paired flow — prompt cap scan
  return {
    status: "PROMPT_CAP",
    message: `Bottle identity confirmed for ${
      bottle.batch.product?.name ?? "Unknown Product"
    }. Now open the bottle and scan the hidden QR code inside the cap to complete verification.`,
    productName: bottle.batch.product?.name ?? "Unknown Product",
    topCode: bottle.cap?.topCode ?? "",
    authMode: "PAIRED",
  }
}