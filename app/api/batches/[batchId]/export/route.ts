import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { makeCsvName } from "@/lib/batch-naming"
import { buildVerifyUrl, buildCapVerifyUrl } from "@/lib/serial"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { batchId } = await params

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const batch = await prisma.batch.findFirst({
    where: { id: batchId, manufacturerId: manufacturer.id },
    include: {
      product: true,
      bottles: {
        include: { cap: true },
      },
    },
  })

  if (!batch) {
    return Response.json({ error: "Batch not found" }, { status: 404 })
  }

  const productName = batch.product?.name ?? "NoProduct"
  const authMode = batch.product?.authMode ?? "PAIRED"
  const filename = makeCsvName(
    manufacturer.companyName,
    productName,
    batch.batchCode
  )

  const headers =
    authMode === "SINGLE"
      ? ["Unit #", "Serial ID", "Verification URL", "QR Filename", "Status"]
      : [
          "Unit #",
          "Bottle Serial ID",
          "Bottle QR URL",
          "Bottle QR Filename",
          "Top Cap Code",
          "Hidden Serial ID",
          "Cap QR URL",
          "Cap QR Filename",
          "Status",
        ]

  const rows = batch.bottles.map((bottle, i) => {
    // Signed bottle URL
    const bottleUrl = buildVerifyUrl(bottle.serialId)

    if (authMode === "SINGLE") {
      return [
        i + 1,
        bottle.serialId,
        bottleUrl,
        `PRODUCT_${bottle.serialId}.png`,
        bottle.status,
      ]
    }

    // Signed cap URL with bottle pairing
    const capUrl = bottle.cap
      ? buildCapVerifyUrl(bottle.cap.hiddenSerialId, bottle.serialId)
      : ""

    return [
      i + 1,
      bottle.serialId,
      bottleUrl,
      `BOTTLE_${bottle.serialId}.png`,
      bottle.cap?.topCode ?? "",
      bottle.cap?.hiddenSerialId ?? "",
      capUrl,
      bottle.cap ? `CAP_${bottle.cap.hiddenSerialId}.png` : "",
      bottle.status,
    ]
  })

  const csv = [
    `# VerifyChain Africa — Serial Export`,
    `# Manufacturer: ${manufacturer.companyName}`,
    `# Product: ${productName}`,
    `# Batch: ${batch.batchCode}`,
    `# Auth Mode: ${authMode}`,
    `# Units: ${batch.bottles.length}`,
    `# Region: ${batch.targetRegion ?? "Not specified"}`,
    `# Generated: ${new Date().toISOString()}`,
    `#`,
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n")

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}