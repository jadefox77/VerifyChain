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
      // Only the earliest label scan is needed (for "first verified"). Loading
      // them all would get slower as a popular or copied code collects scans.
      scanLogs: {
        where: { scanLayer: "BOTTLE" },
        orderBy: { scannedAt: "asc" },
        take: 1,
        select: { scannedAt: true },
      },
    },
  })

  if (!bottle) {
    return {
      status: "NOT_FOUND",
      message:
        "We could not find this code in our records. The product may not be genuine.",
    }
  }

  if (bottle.status === "FLAGGED") {
    return {
      status: "FLAGGED",
      message:
        "This product has been flagged as suspicious. Do not consume it, and keep the pack if you can.",
    }
  }

  const authMode = bottle.batch.product?.authMode ?? "PAIRED"

  // When the product was first verified. updatedAt is not used because it
  // moves on any later status change, such as being flagged. For a paired
  // bottle the check finishes when the cap is opened; otherwise it is the
  // first label scan.
  const firstVerifiedAt =
    bottle.cap?.openedAt ?? bottle.scanLogs[0]?.scannedAt ?? bottle.updatedAt

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
      deviceHash: meta?.deviceHash ?? null,
      userAgent: meta?.userAgent ?? null,
      apiKeyId: meta?.apiKeyId ?? null,
    },
  })

  // Single mode: no cap, so the first scan is the verification.

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
          "This code has already been used to verify a product. If you have just opened this pack, it may not be genuine.",
        firstScan: firstVerifiedAt,
        authMode: "SINGLE",
      }
    }

    return {
      status: "GENUINE_SINGLE",
      // Say only what one code can prove: the code was issued by the
      // manufacturer and has not been checked before. A copy of the code,
      // scanned first, would get this same answer.
      message: `This is a real ${
        bottle.batch.product?.name ?? "product"
      } code, and this is the first time it has been checked.`,
      productName: bottle.batch.product?.name ?? "Unknown Product",
      authMode: "SINGLE",
      openedAt: new Date(),
    }
  }

  // Paired mode

  // Cap flagged
  if (bottle.cap && bottle.cap.status === "FLAGGED") {
    return {
      status: "FLAGGED",
      message:
        "The cap on this bottle has been flagged as suspicious. Do not consume it.",
    }
  }

  // Already fully verified. This must come before the refill check below:
  // after a normal check the bottle and the cap are both OPENED, so a shopper
  // re-scanning the label of a genuine bottle lands here and is told it was
  // already checked, without anything being flagged. A refilled bottle whose
  // label is scanned later gets this same warning.
  if (bottle.status === "OPENED") {
    return {
      status: "ALREADY_VERIFIED",
      message:
        "This bottle has already been opened and checked. If you bought it sealed, it may not be genuine.",
      firstScan: firstVerifiedAt,
      authMode: "PAIRED",
    }
  }

  // Cap opened while the bottle was never checked: possible refill. A normal
  // cap check (even a cap scanned on its own) also moves the bottle out of
  // MINT, so this is only reached by data the normal flow does not produce.
  if (bottle.cap && bottle.cap.status === "OPENED" && bottle.status === "MINT") {
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
          "Cap opened before the bottle label was scanned (possible refill)",
        channel: meta?.channel ?? null,
        ipHash: meta?.ipHash ?? null,
        deviceHash: meta?.deviceHash ?? null,
        userAgent: meta?.userAgent ?? null,
        apiKeyId: meta?.apiKeyId ?? null,
      },
    })

    return {
      status: "CAP_ALREADY_OPENED",
      message:
        "The code inside this bottle's cap has already been scanned, so it has been opened before. It may have been refilled. Do not consume it.",
      capOpenedAt: bottle.cap.openedAt ?? new Date(),
      authMode: "PAIRED",
    }
  }

  // Unpaired bottle: no cap assigned on the production line yet
  if (!bottle.cap && bottle.batch.generationMode === "UNPAIRED") {
    return {
      status: "FLAGGED",
      message:
      "This bottle has not been linked to a cap at the factory yet, so it cannot be fully checked. If you bought it sealed, contact the manufacturer.",
    }
  }

  // Normal paired flow: ask for the cap scan
  return {
    status: "PROMPT_CAP",
    message: `Bottle found: ${
      bottle.batch.product?.name ?? "Unknown product"
    }. Open it and scan the code inside the cap to finish the check.`,
    productName: bottle.batch.product?.name ?? "Unknown Product",
    topCode: bottle.cap?.topCode ?? "",
    authMode: "PAIRED",
  }
}