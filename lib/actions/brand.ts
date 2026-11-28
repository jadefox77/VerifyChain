"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/workspace"
import { MAX_IMAGE_BYTES, parseBrandForm, sniffImageType } from "@/lib/brand"

const PATH = "/dashboard/brand"

type ImageResult =
  | { kind: "none" }
  | { kind: "error"; code: "image_too_big" | "image_type" }
  | { kind: "ok"; data: Uint8Array<ArrayBuffer>; contentType: string }

// Reads an optional uploaded image from the form. The type is decided from
// the file's bytes, never from its name.
async function readImage(formData: FormData, field: string): Promise<ImageResult> {
  const file = formData.get(field)
  if (!file || typeof file === "string" || file.size === 0) return { kind: "none" }
  if (file.size > MAX_IMAGE_BYTES) return { kind: "error", code: "image_too_big" }
  const data = new Uint8Array(await file.arrayBuffer())
  const contentType = sniffImageType(data)
  if (!contentType) return { kind: "error", code: "image_type" }
  return { kind: "ok", data, contentType }
}

export async function saveBrandProfile(formData: FormData) {
  const { manufacturer, userId } = await requireWorkspace("manageBrand")

  const parsed = parseBrandForm((key) => formData.get(key))
  if (!parsed.ok) redirect(`${PATH}?error=${parsed.error}`)
  const input = parsed.value

  const logo = await readImage(formData, "logo")
  if (logo.kind === "error") redirect(`${PATH}?error=${logo.code}`)
  const removeLogo = formData.get("removeLogo") === "on"

  const before = await prisma.brandProfile.findUnique({
    where: { manufacturerId: manufacturer.id },
    select: { logoImageId: true, enabled: true },
  })

  await prisma.$transaction(async (tx) => {
    let logoImageId = before?.logoImageId ?? null
    const oldLogo = logoImageId

    if (logo.kind === "ok") {
      const image = await tx.brandImage.create({
        data: {
          manufacturerId: manufacturer.id,
          contentType: logo.contentType,
          byteSize: logo.data.length,
          data: logo.data,
        },
        select: { id: true },
      })
      logoImageId = image.id
    } else if (removeLogo) {
      logoImageId = null
    }

    await tx.brandProfile.upsert({
      where: { manufacturerId: manufacturer.id },
      create: { manufacturerId: manufacturer.id, ...input, logoImageId },
      update: { ...input, logoImageId },
    })

    // A replaced or removed logo is deleted, so old images do not pile up
    if (oldLogo && oldLogo !== logoImageId) {
      await tx.brandImage.deleteMany({ where: { id: oldLogo, manufacturerId: manufacturer.id } })
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: "BRAND_PROFILE_UPDATED",
        targetType: "Manufacturer",
        targetId: manufacturer.id,
        before: JSON.stringify({ enabled: before?.enabled ?? false }),
        after: JSON.stringify({ enabled: input.enabled, logoChanged: oldLogo !== logoImageId }),
      },
    })
  })

  revalidatePath(PATH)
  redirect(`${PATH}?saved=brand`)
}

export async function saveProductDisplay(formData: FormData) {
  const { manufacturer } = await requireWorkspace("manageBrand")

  const productId = String(formData.get("productId") ?? "")
  const product = await prisma.product.findFirst({
    where: { id: productId, manufacturerId: manufacturer.id },
    select: { id: true, imageId: true },
  })
  if (!product) redirect(`${PATH}?error=not_found`)

  const image = await readImage(formData, "image")
  if (image.kind === "error") redirect(`${PATH}?error=${image.code}#products`)
  const removeImage = formData.get("removeImage") === "on"
  const description = String(formData.get("description") ?? "").trim().slice(0, 500) || null

  await prisma.$transaction(async (tx) => {
    let imageId = product.imageId
    if (image.kind === "ok") {
      const created = await tx.brandImage.create({
        data: {
          manufacturerId: manufacturer.id,
          contentType: image.contentType,
          byteSize: image.data.length,
          data: image.data,
        },
        select: { id: true },
      })
      imageId = created.id
    } else if (removeImage) {
      imageId = null
    }

    await tx.product.update({ where: { id: product.id }, data: { description, imageId } })

    if (product.imageId && product.imageId !== imageId) {
      await tx.brandImage.deleteMany({ where: { id: product.imageId, manufacturerId: manufacturer.id } })
    }
  })

  revalidatePath(PATH)
  redirect(`${PATH}?saved=product#products`)
}
