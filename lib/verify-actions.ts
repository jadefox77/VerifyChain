"use server"

import { cookies } from "next/headers"
import { z } from "zod"
import { verifyBottle, type VerifyResult } from "@/lib/verify"
import { verifyCap, type CapVerifyResult } from "@/lib/verify-cap"
import { verifySignature } from "@/lib/serial"
import { verifyRatelimit } from "@/lib/ratelimit"
import { getRequestMeta } from "@/lib/request-meta"

// The bottle the consumer scanned is remembered for 10 minutes, so the cap
// scan can be checked against it.
const BOTTLE_COOKIE = "vc_bottle"
const BOTTLE_COOKIE_MAX_AGE = 10 * 60

const coordsSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .nullable()
  .optional()

type Coords = z.infer<typeof coordsSchema>

type RateLimited = { status: "RATE_LIMITED"; message: string }
type Invalid = { status: "INVALID"; message: string }

export type BottleActionResult = VerifyResult | RateLimited | Invalid
export type CapActionResult =
  | CapVerifyResult
  | RateLimited
  | Invalid
  | { status: "NEEDS_BOTTLE"; message: string }

const INVALID_QR =
  "This code is not valid. It may have been altered, or the product may not be genuine."

async function guard(): Promise<{ meta: Awaited<ReturnType<typeof getRequestMeta>> } | RateLimited> {
  const meta = await getRequestMeta()
  const { success } = await verifyRatelimit.limit(`web:${meta.ip}`)
  if (!success) {
    return {
      status: "RATE_LIMITED",
      message: "Too many checks from this connection. Wait a minute, then try again.",
    }
  }
  return { meta }
}

export async function verifyBottleAction(
  serialId: string,
  sig: string | undefined,
  coords: Coords
): Promise<BottleActionResult> {
  const id = z.string().min(1).max(20).safeParse(serialId)
  const c = coordsSchema.safeParse(coords)
  if (!id.success || !sig || !verifySignature(id.data, sig)) {
    return { status: "INVALID", message: INVALID_QR }
  }

  const g = await guard()
  if ("status" in g) return g

  const result = await verifyBottle({
    serialId: id.data,
    lat: c.success ? c.data?.lat : undefined,
    lng: c.success ? c.data?.lng : undefined,
    meta: { channel: "web", ipHash: g.meta.ipHash, userAgent: g.meta.userAgent },
  })

  if (result.status === "PROMPT_CAP") {
    const jar = await cookies()
    jar.set(BOTTLE_COOKIE, id.data, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: BOTTLE_COOKIE_MAX_AGE,
    })
  }

  return result
}

export async function verifyCapAction(
  hiddenSerialId: string,
  sig: string | undefined,
  bottleParam: string | undefined,
  coords: Coords
): Promise<CapActionResult> {
  const id = z.string().min(1).max(24).safeParse(hiddenSerialId)
  const c = coordsSchema.safeParse(coords)
  if (!id.success || !sig || !verifySignature(id.data, sig)) {
    return { status: "INVALID", message: INVALID_QR }
  }

  const jar = await cookies()
  const scannedBottle = jar.get(BOTTLE_COOKIE)?.value

  // Prefer the bottle the consumer actually scanned. Pre-paired cap QRs also
  // carry their own bottle id, which is accepted as a fallback but is not a
  // real refill check (the cap vouches for itself).
  const bottleSerialId = scannedBottle || bottleParam
  if (!bottleSerialId) {
    return {
      status: "NEEDS_BOTTLE",
      message:
        "Scan the QR code on the bottle label first, then scan the QR code inside the cap within 10 minutes.",
    }
  }

  const g = await guard()
  if ("status" in g) return g

  const result = await verifyCap({
    hiddenSerialId: id.data,
    bottleSerialId,
    lat: c.success ? c.data?.lat : undefined,
    lng: c.success ? c.data?.lng : undefined,
    meta: { channel: "web", ipHash: g.meta.ipHash, userAgent: g.meta.userAgent },
  })

  jar.delete(BOTTLE_COOKIE)

  if (result.status === "GENUINE") {
    return { ...result, pairingChecked: Boolean(scannedBottle) }
  }
  return result
}
