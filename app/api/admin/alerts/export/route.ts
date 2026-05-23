import { getAdminSession } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const alerts = await prisma.alertLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: {
      manufacturer: { select: { companyName: true, rcNumber: true } },
    },
  })

  const rows = [
    [
      "ID",
      "Severity",
      "Type",
      "Message",
      "Manufacturer",
      "RC Number",
      "Region",
      "Confidence",
      "Resolved",
      "Created At",
    ].join(","),
    ...alerts.map((a) =>
      [
        a.id,
        a.severity,
        a.type,
        `"${a.message.replace(/"/g, '""')}"`,
        a.manufacturer?.companyName ?? "Platform-wide",
        a.manufacturer?.rcNumber ?? "",
        a.region ?? "",
        a.confidenceScore ? Math.round(a.confidenceScore * 100) + "%" : "",
        a.resolved ? "Yes" : "No",
        new Date(a.createdAt).toISOString(),
      ].join(",")
    ),
  ].join("\n")

  return new Response(rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="verifychain-alerts-${Date.now()}.csv"`,
    },
  })
}