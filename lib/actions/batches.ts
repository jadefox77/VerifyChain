"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateSerialId } from "@/lib/serial"
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

  if (!productId || isNaN(quantity) || quantity < 1 || quantity > 5000) return

  const product = await prisma.product.findFirst({
    where: { id: productId, manufacturerId: manufacturer.id },
  })
  if (!product) return

  const batch = await prisma.batch.create({
    data: {
      manufacturerId: manufacturer.id,
      productId,
      quantity,
      notes: notes || null,
    },
  })

  const bottles = Array.from({ length: quantity }, () => ({
    serialId: generateSerialId(),
    batchId: batch.id,
  }))

  await prisma.bottle.createMany({ data: bottles })

  redirect(`/dashboard/batches/${batch.id}`)
}