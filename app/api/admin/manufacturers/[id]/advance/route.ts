import { getAdminSession, canWrite } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { NextRequest } from "next/server"

const STAGES = [
  "PENDING_REVIEW",
  "COMPLIANCE_VERIFICATION",
  "TECHNICAL_INTEGRATION",
  "PILOT_APPROVAL",
  "ACTIVE_PRODUCTION",
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session || !canWrite(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { id } = await params

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id },
    select: { onboardingStatus: true },
  })

  if (!manufacturer) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const currentIndex = STAGES.indexOf(manufacturer.onboardingStatus)
  const nextStatus = STAGES[currentIndex + 1]

  if (!nextStatus) {
    return Response.json({ error: "Already at final stage" }, { status: 400 })
  }

  await prisma.manufacturer.update({
    where: { id },
    data: { onboardingStatus: nextStatus as any },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "MANUFACTURER_STATUS_CHANGED",
      targetType: "Manufacturer",
      targetId: id,
      before: JSON.stringify({ onboardingStatus: manufacturer.onboardingStatus }),
      after: JSON.stringify({ onboardingStatus: nextStatus }),
    },
  })

  return Response.redirect(
    new URL(`/admin/manufacturers/${id}`, req.url)
  )
}