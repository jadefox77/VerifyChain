"use server"

import { cookies } from "next/headers"
import { z } from "zod"
import { verifyBottle, type VerifyResult } from "@/lib/verify"
import { verifyCapDetailed, type CapVerifyResult } from "@/lib/verify-cap"
import { verifySignature } from "@/lib/serial"
import {
  allowRequest,
  verifyIpRatelimit,
  verifyNewDeviceRatelimit,
  verifyRatelimit,
} from "@/lib/ratelimit"
import { getRequestMeta } from "@/lib/request-meta"
import { getOrCreateDevice } from "@/lib/device"
import {
  BOTTLE_TTL_MS,
  addRecentBottle,
  readRecentBottles,
  type RecentBottle,
} from "@/lib/recent-bottles"

// The bottles the consumer scanned recently are remembered for 10 minutes
// each, so a cap scan can be checked against any of them. Someone who scans a
// whole crate and then opens the first bottle is still matched correctly.
const BOTTLE_COOKIE = "vc_bottle"
async function writeRecentBottles(list: RecentBottle[]) {
  const jar = await cookies()
  if (list.length === 0) {
    jar.delete(BOTTLE_COOKIE)
    return
  }
  jar.set(BOTTLE_COOKIE, JSON.stringify(list), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: BOTTLE_TTL_MS / 1000,
  })
}

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
// NEEDS_BOTTLE is part of CapVerifyResult
export type CapActionResult = CapVerifyResult | RateLimited | Invalid

const INVALID_QR =
  "This code is not valid. It may have been altered, or the product may not be genuine."

type Guarded = {
  meta: Awaited<ReturnType<typeof getRequestMeta>>
  deviceHash: string | null
}

async function guard(): Promise<Guarded | RateLimited> {
  const meta = await getRequestMeta()
  const device = await getOrCreateDevice()

  // The tight limit is per device, so shoppers who share a mobile network IP
  // do not block each other. The per-IP limit is only a loose flood ceiling.
  const checks = [
    allowRequest(verifyRatelimit, `web:device:${device.id}`),
    allowRequest(verifyIpRatelimit, `web:ip:${meta.ip}`),
  ]
  if (device.isNew) {
    checks.push(allowRequest(verifyNewDeviceRatelimit, `web:ip:${meta.ip}`))
  }
  const results = await Promise.all(checks)
  if (results.includes(false)) {
    return {
      status: "RATE_LIMITED",
      message: "Too many checks in a short time. Wait a minute, then try again.",
    }
  }
  return { meta, deviceHash: device.hash }
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
    meta: {
      channel: "web",
      ipHash: g.meta.ipHash,
      deviceHash: g.deviceHash,
      userAgent: g.meta.userAgent,
    },
  })

  if (result.status === "PROMPT_CAP") {
    const jar = await cookies()
    const recent = readRecentBottles(jar.get(BOTTLE_COOKIE)?.value)
    await writeRecentBottles(addRecentBottle(recent, id.data))
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
  const recent = readRecentBottles(jar.get(BOTTLE_COOKIE)?.value)
  const scannedBottles = recent.map((b) => b.s)

  // Prefer the bottles the consumer actually scanned. Pre-paired cap QRs also
  // carry their own bottle id, which is accepted as a fallback but is not a
  // real refill check (the cap vouches for itself).
  if (scannedBottles.length === 0 && !bottleParam) {
    return {
      status: "NEEDS_BOTTLE",
      message:
        "Scan the QR code on the bottle label first, then scan the QR code inside the cap within 10 minutes.",
    }
  }

  const g = await guard()
  if ("status" in g) return g

  const { result, capBottleSerialId } = await verifyCapDetailed({
    hiddenSerialId: id.data,
    bottleSerialIds: scannedBottles,
    // Only used when no label was scanned. The engine refuses it while the
    // cap has an open mismatch alert.
    capLinkBottleId: bottleParam,
    lat: c.success ? c.data?.lat : undefined,
    lng: c.success ? c.data?.lng : undefined,
    meta: {
      channel: "web",
      ipHash: g.meta.ipHash,
      deviceHash: g.deviceHash,
      userAgent: g.meta.userAgent,
    },
  })

  // This bottle's check is over, so forget it. The rest of the crate stays.
  if (capBottleSerialId && recent.some((b) => b.s === capBottleSerialId)) {
    await writeRecentBottles(recent.filter((b) => b.s !== capBottleSerialId))
  }

  return result
}
