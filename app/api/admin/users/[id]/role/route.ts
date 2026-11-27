import { getAdminSession, isSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { seeOther } from "@/lib/see-other"
import type { UserRole } from "@prisma/client"

const VALID_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "MANUFACTURER_ADMIN",
  "FACTORY_OPERATOR",
  "FRAUD_ANALYST",
  "REGULATORY_OBSERVER",
  "DISTRIBUTOR_MANAGER",
  "SUPPORT",
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session || !isSuperAdmin(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { id } = await params
  const formData = await req.formData()
  const role = formData.get("role") as UserRole

  if (!VALID_ROLES.includes(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 })
  }

  // Prevent self-demotion — safety guard
  if (id === session.user.id && role !== "SUPER_ADMIN") {
    return Response.json(
      { error: "Cannot demote your own account" },
      { status: 400 }
    )
  }

  const before = await prisma.user.findUnique({
    where: { id },
    select: { role: true, email: true },
  })

  if (!before) {
    return Response.json({ error: "User not found" }, { status: 404 })
  }

  await prisma.user.update({
    where: { id },
    data: { role },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "USER_ROLE_UPDATED",
      targetType: "User",
      targetId: id,
      before: JSON.stringify({ role: before.role }),
      after: JSON.stringify({ role }),
    },
  })

  return seeOther("/admin/users")
}