import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import QRCode from "qrcode"
import JSZip from "jszip"
import { makeBatchZipName } from "@/lib/batch-naming"
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
  const baseName = makeBatchZipName(
    manufacturer.companyName,
    productName,
    batch.batchCode
  )

  const zip = new JSZip()

  if (authMode === "SINGLE") {
    const folder = zip.folder("product-qr")!

    for (const bottle of batch.bottles) {
      // Use signed URL
      const url = buildVerifyUrl(bottle.serialId)
      const qr = await QRCode.toBuffer(url, {
        errorCorrectionLevel: "H",
        width: 400,
        margin: 2,
      })
      folder.file(`PRODUCT_${bottle.serialId}.png`, qr)
    }
  } else {
    const bottleFolder = zip.folder("bottle-qr")!
    const capFolder = zip.folder("cap-qr")!

    for (const bottle of batch.bottles) {
      // Signed bottle URL
      const bottleUrl = buildVerifyUrl(bottle.serialId)
      const bottleQr = await QRCode.toBuffer(bottleUrl, {
        errorCorrectionLevel: "H",
        width: 400,
        margin: 2,
      })
      bottleFolder.file(`BOTTLE_${bottle.serialId}.png`, bottleQr)

      // Signed cap URL — includes bottle serial for pairing validation
      if (bottle.cap) {
        const capUrl = buildCapVerifyUrl(
          bottle.cap.hiddenSerialId,
          bottle.serialId
        )
        const capQr = await QRCode.toBuffer(capUrl, {
          errorCorrectionLevel: "H",
          width: 400,
          margin: 2,
        })
        capFolder.file(`CAP_${bottle.cap.hiddenSerialId}.png`, capQr)
      }
    }
  }

  // README
  const readmeLines = [
    `VerifyChain Africa — Batch Export`,
    `═══════════════════════════════════`,
    `Manufacturer : ${manufacturer.companyName}`,
    `Product      : ${productName}`,
    `Batch Code   : ${batch.batchCode}`,
    `Auth Mode    : ${authMode}`,
    `Units        : ${batch.bottles.length}`,
    `Region       : ${batch.targetRegion ?? "Not specified"}`,
    `Generated    : ${new Date().toISOString()}`,
    ``,
    authMode === "SINGLE"
      ? [
          `SINGLE MODE INSTRUCTIONS`,
          `────────────────────────`,
          `Each QR in /product-qr/ goes on one unit of packaging.`,
          `Consumer scans once and gets immediate verification result.`,
          `No cap scanning required.`,
        ].join("\n")
      : [
          `PAIRED MODE INSTRUCTIONS`,
          `────────────────────────`,
          `/bottle-qr/  → Print on bottle label (consumer-visible)`,
          `/cap-qr/     → Print inside bottle cap (hidden until opened)`,
          `Each BOTTLE_xxx.png is paired with its CAP_xxx.png.`,
          `Do not mix QR codes across units.`,
        ].join("\n"),
  ]

  zip.file("README.txt", readmeLines.join("\n"))

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${baseName}.zip"`,
    },
  })
}