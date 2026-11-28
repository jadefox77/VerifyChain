import { getAdminSession, canResolveAlerts } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session || !canResolveAlerts(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { id } = await params

  // Only an open alert can be resolved, so the first person to resolve it
  // stays on record even if someone else submits the form again.
  const { count } = await prisma.alertLog.updateMany({
    where: { id, resolved: false },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: session.user.id,
    },
  })

  if (count > 0) await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ALERT_RESOLVED",
      targetType: "AlertLog",
      targetId: id,
    },
  })

  // Go back to the page the admin came from (keeping its filters). Only the
  // path of the Referer is used, and only inside /admin, so it cannot send the
  // admin to another site. A relative Location also stays correct behind proxies.
  let target = "/admin/alerts"
  const referer = req.headers.get("referer")
  if (referer) {
    try {
      const url = new URL(referer)
      if (url.pathname.startsWith("/admin/")) {
        // Drop the outcome of an earlier restore, so its banner is not shown again
        url.searchParams.delete("restored")
        url.searchParams.delete("restore_error")
        target = url.pathname + url.search
      }
    } catch {
      // Malformed Referer, use the default
    }
  }
  return new Response(null, { status: 303, headers: { Location: target } })
}
