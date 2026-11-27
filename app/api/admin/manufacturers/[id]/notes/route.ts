import { getAdminSession, canWrite } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { seeOther } from "@/lib/see-other"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session || !canWrite(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { id } = await params
  const formData = await req.formData()
  const content = formData.get("content") as string

  if (!content?.trim()) {
    return Response.json({ error: "Content required" }, { status: 400 })
  }

  await prisma.adminNote.create({
    data: {
      manufacturerId: id,
      authorId: session.user.id,
      authorName: session.user.name ?? session.user.email ?? "Admin",
      content: content.trim(),
      isInternal: true,
    },
  })

  return seeOther(`/admin/manufacturers/${encodeURIComponent(id)}`)
}