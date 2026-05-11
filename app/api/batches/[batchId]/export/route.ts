import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatSerialId, buildVerifyUrl } from "@/lib/serial"
import { NextRequest, NextResponse } from "next/server"

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

  const rows = [
    ["Serial ID", "Formatted", "QR URL", "Status", "Created At"],
    ...batch.bottles.map((b) => [
      b.serialId,
      formatSerialId(b.serialId),
      buildVerifyUrl(b.serialId),
      b.status,
      b.createdAt.toISOString(),
    ]),
  ]

  const csv = rows.map((r) => r.join(",")).join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="batch-${batchId}.csv"`,
    },
  })
}