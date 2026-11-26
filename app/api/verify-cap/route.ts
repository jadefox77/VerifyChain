import { NextRequest, NextResponse } from "next/server"
import { verifyCap } from "@/lib/verify-cap"
import { verifyRatelimit } from "@/lib/ratelimit"
import { z } from "zod"
import { clientIpFrom, hashIp } from "@/lib/request-meta"

const schema = z.object({
  hiddenSerialId: z.string().min(1).max(24),
  bottleSerialId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

export async function POST(req: NextRequest) {
  const ip = clientIpFrom(req.headers)

  try {
    const { success } = await verifyRatelimit.limit(ip)
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429 }
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = await verifyCap({
      ...parsed.data,
      meta: {
        channel: "api",
        ipHash: hashIp(ip),
        userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    })
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("Cap verify error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}