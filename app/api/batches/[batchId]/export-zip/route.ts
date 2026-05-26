import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import QRCode from "qrcode"
import JSZip from "jszip"
import { makeBatchZipName } from "@/lib/batch-naming"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://verifychain-africa.vercel.app"

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
    // Single mode — one folder, one QR per unit
    const folder = zip.folder("product-qr")!

    for (const bottle of batch.bottles) {
      const url = `${APP_URL}/verify/${bottle.serialId}`
      const qr = await QRCode.toBuffer(url, {
        errorCorrectionLevel: "H",
        width: 400,
        margin: 2,
      })
      folder.file(`PRODUCT_${bottle.serialId}.png`, qr)
    }
  } else {
    // Paired mode — two folders
    const bottleFolder = zip.folder("bottle-qr")!
    const capFolder = zip.folder("cap-qr")!

    for (const bottle of batch.bottles) {
      // Bottle QR
      const bottleUrl = `${APP_URL}/verify/${bottle.serialId}`
      const bottleQr = await QRCode.toBuffer(bottleUrl, {
        errorCorrectionLevel: "H",
        width: 400,
        margin: 2,
      })
      bottleFolder.file(`BOTTLE_${bottle.serialId}.png`, bottleQr)

      // Cap QR (hidden internal)
      if (bottle.cap) {
        const capUrl = `${APP_URL}/verify/cap/${bottle.cap.hiddenSerialId}`
        const capQr = await QRCode.toBuffer(capUrl, {
          errorCorrectionLevel: "H",
          width: 400,
          margin: 2,
        })
        capFolder.file(`CAP_${bottle.cap.hiddenSerialId}.png`, capQr)
      }
    }
  }

  // Add README inside ZIP
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