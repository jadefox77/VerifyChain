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
import { getMonthlyUsage } from "@/lib/plans"

export async function generateBatch(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")
  if (manufacturer.onboardingStatus !== "ACTIVE_PRODUCTION") redirect("/onboarding/pending")

  const productId = formData.get("productId") as string
  const quantity = parseInt(formData.get("quantity") as string, 10)
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500)
  const targetRegion = String(formData.get("targetRegion") ?? "").trim()
  const generationMode =
    formData.get("generationMode") === "UNPAIRED" ? "UNPAIRED" : "PRE_PAIRED"

  if (!productId || isNaN(quantity) || quantity < 1 || quantity > 5000)
    return

  const product = await prisma.product.findFirst({
    where: { id: productId, manufacturerId: manufacturer.id },
  })
  if (!product) return

  // Soft plan limit: batches are allowed while this month's usage is under the
  // allowance. Once it is reached, new batches wait until the allowance resets
  // or the plan changes.
  const usage = await getMonthlyUsage(manufacturer.id, manufacturer.subscriptionPlan)
  if (usage.state === "over") redirect("/dashboard/batches?error=limit")

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
    },
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

  // Pre-paired: link each cap directly to its bottle
  if (product.authMode === "PAIRED" && generationMode === "PRE_PAIRED") {
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
        hiddenHmacSig: nodeCrypto
          .createHmac("sha256", process.env.QR_SECRET!)
          .update(hiddenSerialId)
          .digest("hex"),
      }
    })

    await prisma.cap.createMany({ data: capsData })
  }

  // Unpaired: cap identities with no bottle yet, linked on the production line
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
      }
    })

    await prisma.cap.createMany({ data: capsData })
  }

  redirect(`/dashboard/batches/${batch.id}`)
}