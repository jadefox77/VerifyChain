import { getAdminSession } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
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

  const resolverIds = [...new Set(alerts.map((a) => a.resolvedBy).filter((v): v is string => !!v))]
  const resolvers = resolverIds.length
    ? await prisma.user.findMany({ where: { id: { in: resolverIds } }, select: { id: true, name: true, email: true } })
    : []
  const resolverNames = new Map(resolvers.map((u) => [u.id, u.name ?? u.email ?? ""]))

  // Quote every text field so commas and quotes in names do not break columns.
  const csv = (v: string) => `"${v.replace(/"/g, '""')}"`

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
      "Resolved By",
      "Resolved At",
    ].join(","),
    ...alerts.map((a) =>
      [
        a.id,
        a.severity,
        a.type,
        csv(a.message),
        csv(a.manufacturer?.companyName ?? "Platform-wide"),
        csv(a.manufacturer?.rcNumber ?? ""),
        csv(a.region ?? ""),
        a.confidenceScore ? Math.round(a.confidenceScore * 100) + "%" : "",
        a.resolved ? "Yes" : "No",
        new Date(a.createdAt).toISOString(),
        csv(a.resolvedBy ? (resolverNames.get(a.resolvedBy) ?? a.resolvedBy) : ""),
        a.resolvedAt ? new Date(a.resolvedAt).toISOString() : "",
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