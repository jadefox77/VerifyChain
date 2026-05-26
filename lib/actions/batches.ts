"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  generateSerialId,
  generateTopCapCode,
  generateHiddenSerialId,
} from "@/lib/serial"
import { redirect } from "next/navigation"
import crypto from "crypto"

// ── Naming utility ────────────────────────────────────────────────────────────

export function makeManufacturerCode(companyName: string): string {
  return companyName
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6)
}

export function makeBatchZipName(
  companyName: string,
  productName: string,
  batchCode: string
): string {
  const mfr = makeManufacturerCode(companyName)
  const product = productName
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12)
  const date = new Date().toISOString().split("T")[0]
  return `VC_${mfr}_${product}_${batchCode}_${date}`
}

export function makeCsvName(
  companyName: string,
  productName: string,
  batchCode: string
): string {
  return `${makeBatchZipName(companyName, productName, batchCode)}_serials.csv`
}

// ── Batch generation ──────────────────────────────────────────────────────────

export async function generateBatch(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const productId = formData.get("productId") as string
  const quantity = parseInt(formData.get("quantity") as string, 10)
  const notes = formData.get("notes") as string
  const targetRegion = formData.get("targetRegion") as string

  if (!productId || isNaN(quantity) || quantity < 1 || quantity > 5000) return

  const product = await prisma.product.findFirst({
    where: { id: productId, manufacturerId: manufacturer.id },
  })
  if (!product) return

  // Generate a structured batch code
  const mfrCode = makeManufacturerCode(manufacturer.companyName)
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "")
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const batchCode = `VC-${mfrCode}-${date}-${random}`

  // Create the batch
  const batch = await prisma.batch.create({
    data: {
      manufacturerId: manufacturer.id,
      productId,
      bottleCount: quantity,
      notes: notes || null,
      targetRegion: targetRegion || null,
      batchCode,
    },
  })

  // Generate bottles
  const bottlesData = Array.from({ length: quantity }, () => {
    const serialId = generateSerialId()
    return {
      serialId,
      batchId: batch.id,
      manufacturerId: manufacturer.id,
      hmacSig: crypto
        .createHmac("sha256", process.env.QR_SECRET!)
        .update(serialId)
        .digest("hex"),
    }
  })

  await prisma.bottle.createMany({ data: bottlesData })

  // Only generate caps for PAIRED mode products
  if (product.authMode === "PAIRED") {
    const bottles = await prisma.bottle.findMany({
      where: { batchId: batch.id },
      select: { id: true },
    })

    const capsData = bottles.map((bottle) => {
      const hiddenSerialId = generateHiddenSerialId()
      return {
        bottleId: bottle.id,
        topCode: generateTopCapCode(),
        hiddenSerialId,
        hiddenHmacSig: crypto
          .createHmac("sha256", process.env.QR_SECRET!)
          .update(hiddenSerialId)
          .digest("hex"),
      }
    })

    await prisma.cap.createMany({ data: capsData })
  }

  redirect(`/dashboard/batches/${batch.id}`)
}