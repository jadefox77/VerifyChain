import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatSerialId, buildVerifyUrl, buildCapVerifyUrl } from "@/lib/serial"
import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import JSZip from "jszip"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const batch = await prisma.batch.findFirst({
    where: { id: batchId, manufacturerId: manufacturer.id },
    include: {
      product: true,
      bottles: {
        orderBy: { createdAt: "asc" },
        include: { cap: true },
      },
    },
  })

  if (!batch) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const zip = new JSZip()

  // Two folders — one for bottle label QRs, one for hidden cap QRs
  const bottleFolder = zip.folder(`batch-${batchId}/bottle-qr`)!
  const capFolder = zip.folder(`batch-${batchId}/cap-qr`)!

  for (const bottle of batch.bottles) {
    // Bottle label QR
    const bottleUrl = buildVerifyUrl(bottle.serialId)
    const bottleQr = await QRCode.toBuffer(bottleUrl, {
      type: "png",
      width: 300,
      margin: 2,
      errorCorrectionLevel: "H",
    })
    const bottleFileName = `${formatSerialId(bottle.serialId)}.png`
    bottleFolder.file(bottleFileName, bottleQr)

    // Hidden cap QR
    if (bottle.cap) {
      const capUrl = buildCapVerifyUrl(bottle.cap.hiddenSerialId)
      const capQr = await QRCode.toBuffer(capUrl, {
        type: "png",
        width: 300,
        margin: 2,
        errorCorrectionLevel: "H",
      })
      // Named by top-cap code so printers can match them easily
      const capFileName = `${formatSerialId(bottle.cap.topCode)}.png`
      capFolder.file(capFileName, capQr)
    }
  }

  // Reference CSV inside the ZIP
  const csvRows = [
    [
      "Bottle Serial",
      "Bottle QR URL",
      "Top Cap Code",
      "Hidden Cap Serial",
      "Hidden Cap QR URL",
      "Status",
    ],
    ...batch.bottles.map((b) => [
      b.serialId,
      buildVerifyUrl(b.serialId),
      b.cap?.topCode ?? "",
      b.cap?.hiddenSerialId ?? "",
      b.cap ? buildCapVerifyUrl(b.cap.hiddenSerialId) : "",
      b.status,
    ]),
  ]
  const csv = csvRows.map((r) => r.join(",")).join("\n")
  zip.file(`batch-${batchId}/serials.csv`, csv)

  const zipBuffer = await zip.generateAsync({ type: "uint8array" })
  const blob = new Blob([zipBuffer.buffer as ArrayBuffer], {
    type: "application/zip",
  })

  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="batch-${batchId}.zip"`,
    },
  })
}