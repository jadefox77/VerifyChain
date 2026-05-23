import { getAdminSession, isSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

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
    data: { onboardingStatus: "SUSPENDED" },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MANUFACTURER_SUSPENDED",
      targetType: "Manufacturer",
      targetId: id,
    },
  })

  return Response.redirect(new URL(`/admin/manufacturers/${id}`, req.url))
}