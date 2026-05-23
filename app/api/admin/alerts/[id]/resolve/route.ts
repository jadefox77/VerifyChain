import { getAdminSession, canWrite } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session || !canWrite(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { id } = await params

  await prisma.alertLog.update({
    where: { id },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: session.user.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ALERT_RESOLVED",
      targetType: "AlertLog",
      targetId: id,
    },
  })

  // Redirect back to alerts page preserving filters
  const referer = req.headers.get("referer") ?? "/admin/alerts"
  return Response.redirect(new URL(referer, req.url))
}