import { getAdminSession, canRestoreProducts } from "@/lib/admin-auth"
import { restoreFromAlert } from "@/lib/restore"
import { NextRequest } from "next/server"

// POST from the alerts page: put the products a mismatch or drift alert
// flagged back to their earlier state, resolve the alert and record why.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session || !canRestoreProducts(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { id } = await params
  let reason: unknown = null
  try {
    reason = (await req.formData()).get("reason")
  } catch {
    reason = null
  }
  const result = await restoreFromAlert(id, session.user.id, reason)

  // Back to the page the admin came from (same rule as resolve: only a path
  // inside /admin), with the outcome in the query string.
  let target = new URL("/admin/alerts", "http://local")
  const referer = req.headers.get("referer")
  if (referer) {
    try {
      const url = new URL(referer)
      if (url.pathname.startsWith("/admin/")) target = new URL(url.pathname + url.search, "http://local")
    } catch {
      // Malformed Referer, use the default
    }
  }
  target.searchParams.delete("restored")
  target.searchParams.delete("restore_error")
  if (result.ok) target.searchParams.set("restored", String(result.restored))
  else target.searchParams.set("restore_error", result.error)

  return new Response(null, { status: 303, headers: { Location: target.pathname + target.search } })
}
