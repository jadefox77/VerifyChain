import crypto from "crypto"
import { cookies } from "next/headers"

// An anonymous id for the phone or browser that is checking products. It
// holds no personal data. It lets rate limits and fraud rules tell apart
// shoppers who share one mobile network IP address.
const DEVICE_COOKIE = "vc_device"
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

export type Device = {
  // Raw cookie value. Use it only as a rate limit key, never store it.
  id: string
  // Keyed hash of the id, safe to store on scan logs.
  hash: string | null
  // True when this request had no device cookie yet.
  isNew: boolean
}

export function hashDevice(id: string): string | null {
  const secret = process.env.QR_SECRET
  if (!secret) return null
  return crypto
    .createHmac("sha256", secret)
    .update(`device:${id}`)
    .digest("hex")
    .slice(0, 32)
}

// Reads the device cookie, or creates one. Call it only from a server action
// or route handler, where cookies can be set.
export async function getOrCreateDevice(): Promise<Device> {
  const jar = await cookies()
  const existing = jar.get(DEVICE_COOKIE)?.value
  if (existing && DEVICE_ID_PATTERN.test(existing)) {
    return { id: existing, hash: hashDevice(existing), isNew: false }
  }

  const id = crypto.randomBytes(18).toString("base64url")
  jar.set(DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  })
  return { id, hash: hashDevice(id), isNew: true }
}
