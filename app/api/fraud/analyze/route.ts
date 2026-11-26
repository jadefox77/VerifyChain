import { runFraudPipeline, runFastFraudPipeline } from "@/lib/fraud-pipeline"
import { getAdminSession } from "@/lib/admin-auth"
import { NextRequest } from "next/server"

export const maxDuration = 10

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Run only fraud rate recomputation on hobby plan
    // Full pipeline runs via cron daily
    const result = await runFastFraudPipeline()
    return Response.json({ success: true, result })
  } catch (err) {
    console.error("[fraud-pipeline] Error:", err)
    return Response.json(
      { error: "Pipeline failed", detail: String(err) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  // x-cron-secret is still accepted for manual runs.
  const secret = process.env.CRON_SECRET
  const bearer = req.headers.get("authorization")
  const manual = req.headers.get("x-cron-secret")
  const authorized =
    Boolean(secret) && (bearer === `Bearer ${secret}` || manual === secret)
  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runFraudPipeline()
    return Response.json({ success: true, result })
  } catch (err) {
    return Response.json(
      { error: "Pipeline failed", detail: String(err) },
      { status: 500 }
    )
  }
}