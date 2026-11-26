import crypto from "crypto"
import { headers } from "next/headers"

export type RequestMeta = {
  ip: string
  ipHash: string | null
  userAgent: string | null
}

// x-forwarded-for can hold a chain ("client, proxy1, proxy2").
// The first entry is the original client.
export function clientIpFrom(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return h.get("x-real-ip")?.trim() || "anonymous"
}

// We never store raw IPs. A keyed hash still lets the fraud pipeline
// group scans coming from the same source.
export function hashIp(ip: string): string | null {
  if (ip === "anonymous") return null
  const secret = process.env.QR_SECRET
  if (!secret) return null
  return crypto
    .createHmac("sha256", secret)
    .update(`ip:${ip}`)
    .digest("hex")
    .slice(0, 32)
}

export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers()
  const ip = clientIpFrom(h)
  return {
    ip,
    ipHash: hashIp(ip),
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  }
}
