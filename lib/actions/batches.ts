"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  generateSerialId,
  generateTopCapCode,
  generateHiddenSerialId,
} from "@/lib/serial"
import { redirect } from "next/navigation"
import nodeCrypto from "crypto"
import { makeManufacturerCode } from "@/lib/batch-naming"

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
  const generationMode =
    (formData.get("generationMode") as string)?.trim() || "PRE_PAIRED"

  if (!productId || isNaN(quantity) || quantity < 1 || quantity > 5000)
    return

  const product = await prisma.product.findFirst({
    where: { id: productId, manufacturerId: manufacturer.id },
  })
  if (!product) return

  const mfrCode = makeManufacturerCode(manufacturer.companyName)
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "")
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const batchCode = `VC-${mfrCode}-${date}-${random}`

  const batch = await prisma.batch.create({
    data: {
      manufacturerId: manufacturer.id,
      productId,
      bottleCount: quantity,
      notes: notes || null,
      targetRegion: targetRegion || null,
      batchCode,
      generationMode,
    } as any,
  })

  // Generate bottles
  const bottlesData = Array.from({ length: quantity }, () => {
    const serialId = generateSerialId()
    return {
      serialId,
      batchId: batch.id,
      manufacturerId: manufacturer.id,
      hmacSig: nodeCrypto
        .createHmac("sha256", process.env.QR_SECRET!)
        .update(serialId)
        .digest("hex"),
    }
  })

  await prisma.bottle.createMany({ data: bottlesData })

  // ── PRE_PAIRED — link each cap directly to its bottle ──────────────────
  if (product.authMode === "PAIRED" && generationMode === "PRE_PAIRED") {
    const bottles = await prisma.bottle.findMany({
      where: { batchId: batch.id },
      select: { id: true },
    })

    const capsData = bottles.map((bottle) => {
      const hiddenSerialId = generateHiddenSerialId()
      return {
        bottleId: bottle.id,  // ← directly linked to bottle
        topCode: generateTopCapCode(),
        hiddenSerialId,
        hiddenHmacSig: nodeCrypto
          .createHmac("sha256", process.env.QR_SECRET!)
          .update(hiddenSerialId)
          .digest("hex"),
      }
    })

    await prisma.cap.createMany({ data: capsData })
  }

  // ── UNPAIRED — generate cap identities with no bottle link ─────────────
  if (product.authMode === "PAIRED" && generationMode === "UNPAIRED") {
    const capsData = Array.from({ length: quantity }, () => {
      const hiddenSerialId = generateHiddenSerialId()
      return {
        topCode: generateTopCapCode(),
        hiddenSerialId,
        hiddenHmacSig: nodeCrypto
          .createHmac("sha256", process.env.QR_SECRET!)
          .update(hiddenSerialId)
          .digest("hex"),
        batchId: batch.id,
        // bottleId intentionally omitted — null by default
      }
    })

    await prisma.cap.createMany({ data: capsData as any })
  }

  // ── SINGLE mode — no caps needed ───────────────────────────────────────
  // Bottles only, no cap generation

  redirect(`/dashboard/batches/${batch.id}`)
}