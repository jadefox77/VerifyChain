import { NextRequest, NextResponse } from "next/server"
import { verifyBottle } from "@/lib/verify"
import { allowRequest, verifyRatelimit } from "@/lib/ratelimit"
import { z } from "zod"
import { clientIpFrom, hashIp } from "@/lib/request-meta"

const schema = z.object({
  serialId: z.string().min(1).max(20),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

export async function POST(req: NextRequest) {
  const ip = clientIpFrom(req.headers)

  try {
    // API callers have no device cookie, so this stays per IP. If Redis is
    // down the request is allowed rather than failing.
    if (!(await allowRequest(verifyRatelimit, `api:ip:${ip}`))) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
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

    const result = await verifyBottle({
      ...parsed.data,
      meta: {
        channel: "api",
        ipHash: hashIp(ip),
        userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    })
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("Verify error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}