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
  const generationMode = batch.generationMode ?? "PRE_PAIRED"
  const filename = makeCsvName(
    manufacturer.companyName,
    productName,
    batch.batchCode
  )

  const headers =
    authMode === "SINGLE"
      ? [
          "Unit #",
          "Serial ID",
          "Verification URL",
          "QR Filename",
          "Status",
        ]
      : generationMode === "UNPAIRED"
      ? [
          "Type",
          "Unit #",
          "Serial ID / Top Code",
          "Hidden Serial ID",
          "QR Filename",
          "Status",
        ]
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

  let rows: (string | number)[][] = []

  if (authMode === "SINGLE") {
    rows = batch.bottles.map((bottle, i) => [
      i + 1,
      bottle.serialId,
      buildVerifyUrl(bottle.serialId),
      `PRODUCT_${bottle.serialId}.png`,
      bottle.status,
    ])
  } else if (generationMode === "UNPAIRED") {
    const bottleRows: (string | number)[][] = batch.bottles.map(
      (bottle, i) => [
        "BOTTLE",
        i + 1,
        bottle.serialId,
        "",
        `BOTTLE_${bottle.serialId}.png`,
        bottle.status,
      ]
    )

    const unpairedCaps = await prisma.cap.findMany({
     where: {
  batchId: batch.id,
  bottleId: { equals: null },
},
      select: {
        topCode: true,
        hiddenSerialId: true,
        status: true,
      },
    })

    const capRows: (string | number)[][] = unpairedCaps.map((cap, i) => [
      "CAP",
      i + 1,
      cap.topCode,
      cap.hiddenSerialId,
      `CAP_${cap.hiddenSerialId}.png`,
      cap.status,
    ])

    rows = [...bottleRows, ...capRows]
  } else {
    rows = batch.bottles.map((bottle, i) => {
      const cap = bottle.cap
      const bottleUrl = buildVerifyUrl(bottle.serialId)
      const capUrl = cap
        ? buildCapVerifyUrl(cap.hiddenSerialId, bottle.serialId)
        : ""

      return [
        i + 1,
        bottle.serialId,
        bottleUrl,
        `BOTTLE_${bottle.serialId}.png`,
        cap?.topCode ?? "",
        cap?.hiddenSerialId ?? "",
        capUrl,
        cap ? `CAP_${cap.hiddenSerialId}.png` : "",
        bottle.status,
      ]
    })
  }

  const csv = [
    `# VerifyChain Africa serial export`,
    `# Manufacturer: ${manufacturer.companyName}`,
    `# Product: ${productName}`,
    `# Batch: ${batch.batchCode}`,
    `# Auth Mode: ${authMode}`,
    `# Generation Mode: ${generationMode}`,
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