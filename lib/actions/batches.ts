"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  generateSerialId,
  generateTopCapCode,
  generateHiddenSerialId,
} from "@/lib/serial"
import { redirect } from "next/navigation"

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
      quantity,
      notes: notes || null,
      targetRegion: targetRegion || null,
    },
  })

  // Generate bottles and caps together
  const bottlesData = Array.from({ length: quantity }, () => ({
    serialId: generateSerialId(),
    batchId: batch.id,
  }))

  // Create all bottles first
  await prisma.bottle.createMany({ data: bottlesData })

  // Fetch the created bottles to get their IDs
  const bottles = await prisma.bottle.findMany({
    where: { batchId: batch.id },
    select: { id: true },
  })

  // Create a cap for every bottle
  const capsData = bottles.map((bottle) => ({
    bottleId: bottle.id,
    topCode: generateTopCapCode(),
    hiddenSerialId: generateHiddenSerialId(),
  }))

  await prisma.cap.createMany({ data: capsData })

  redirect(`/dashboard/batches/${batch.id}`)
}