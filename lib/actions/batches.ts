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

  // Create the batch
  const batch = await prisma.batch.create({
    data: {
      manufacturerId: manufacturer.id,
      productId,
      bottleCount: quantity,
      notes: notes || null,
      targetRegion: targetRegion || null,
      batchCode: `BATCH-${Date.now()}`,
    },
  })

  // Generate bottles with all required fields
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

  // Fetch created bottles to get their IDs
  const bottles = await prisma.bottle.findMany({
    where: { batchId: batch.id },
    select: { id: true },
  })

  // Create caps with all required fields including hiddenHmacSig
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

  redirect(`/dashboard/batches/${batch.id}`)
}