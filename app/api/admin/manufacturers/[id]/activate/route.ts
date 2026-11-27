import { getAdminSession, isSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { seeOther } from "@/lib/see-other"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session || !isSuperAdmin(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { id } = await params

  await prisma.manufacturer.update({
    where: { id },
    data: { onboardingStatus: "ACTIVE_PRODUCTION" },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MANUFACTURER_ACTIVATED",
      targetType: "Manufacturer",
      targetId: id,
    },
  })

  return seeOther(`/admin/manufacturers/${encodeURIComponent(id)}`)
}