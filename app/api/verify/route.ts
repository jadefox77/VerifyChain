import { NextRequest, NextResponse } from "next/server"
import { verifyBottle } from "@/lib/verify"
import { verifyRatelimit } from "@/lib/ratelimit"
import { z } from "zod"

const schema = z.object({
  serialId: z.string().min(1).max(20),
  phoneHash: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"
  const { success } = await verifyRatelimit.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = await verifyBottle(parsed.data)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("Verify error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}