import { getAdminSession, canViewRegulatory } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getAdminSession()
  if (!session || !canViewRegulatory(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  const last90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const incidents = await prisma.alertLog.findMany({
    where: {
      severity: { in: ["HIGH_CONCERN", "CRITICAL"] },
      createdAt: { gte: last90Days },
    },
    orderBy: { createdAt: "desc" },
    include: {
      manufacturer: {
        select: {
          companyName: true,
          rcNumber: true,
          nafdacNumbers: true,
        },
      },
    },
  })

  const rows = [
    [
      "Date",
      "Severity",
      "Type",
      "Incident Description",
      "Manufacturer",
      "RC Number",
      "NAFDAC Numbers",
      "Region",
      "Confidence Score",
      "Resolved",
    ].join(","),
    ...incidents.map((i) =>
      [
        new Date(i.createdAt).toISOString().split("T")[0],
        i.severity,
        i.type,
        `"${i.message.replace(/"/g, '""')}"`,
        i.manufacturer?.companyName ?? "Platform-wide",
        i.manufacturer?.rcNumber ?? "",
        i.manufacturer?.nafdacNumbers ?? "",
        i.region ?? "",
        i.confidenceScore
          ? Math.round(i.confidenceScore * 100) + "%"
          : "",
        i.resolved ? "Yes" : "No",
      ].join(",")
    ),
  ].join("\n")

  const filename = `verifychain-regulatory-report-${
    new Date().toISOString().split("T")[0]
  }.csv`

  return new Response(rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}