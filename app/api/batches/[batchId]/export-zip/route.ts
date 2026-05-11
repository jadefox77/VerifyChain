import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatSerialId, buildVerifyUrl } from "@/lib/serial"
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
      bottles: { orderBy: { createdAt: "asc" } },
    },
  })

  if (!batch) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const zip = new JSZip()
  const folder = zip.folder(`batch-${batchId}`)!

  // Generate a QR code PNG for every bottle
  for (const bottle of batch.bottles) {
    const url = buildVerifyUrl(bottle.serialId)
    const pngBuffer = await QRCode.toBuffer(url, {
      type: "png",
      width: 300,
      margin: 2,
      errorCorrectionLevel: "H",
    })
    const fileName = `${formatSerialId(bottle.serialId)}.png`
    folder.file(fileName, pngBuffer)
  }

  // Also include a CSV inside the ZIP for reference
  const csvRows = [
    ["Serial ID", "Formatted", "QR URL", "Status"],
    ...batch.bottles.map((b) => [
      b.serialId,
      formatSerialId(b.serialId),
      buildVerifyUrl(b.serialId),
      b.status,
    ]),
  ]
  const csv = csvRows.map((r) => r.join(",")).join("\n")
  folder.file("serials.csv", csv)

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="batch-${batchId}.zip"`,
    },
  })
}