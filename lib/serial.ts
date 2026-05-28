import { customAlphabet } from "nanoid"
import crypto from "crypto"

// Bottle label QR — 12 chars, no ambiguous characters
const bottleAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const generateBottleId = customAlphabet(bottleAlphabet, 12)

// Top-cap code — 6 chars, easy to read and type
const topCapAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const generateTopCode = customAlphabet(topCapAlphabet, 6)

// Hidden cap QR — 16 chars, maximum entropy
const generateHiddenId = customAlphabet(bottleAlphabet, 16)

export function generateSerialId(): string {
  return generateBottleId()
}

export function generateTopCapCode(): string {
  return generateTopCode()
}

export function generateHiddenSerialId(): string {
  return generateHiddenId()
}

export function formatSerialId(serialId: string): string {
  if (serialId.length === 12) {
    return `${serialId.slice(0, 4)}-${serialId.slice(4, 8)}-${serialId.slice(8, 12)}`
  }
  if (serialId.length === 6) {
    return `${serialId.slice(0, 3)}-${serialId.slice(3, 6)}`
  }
  return serialId
}

function signSerial(serialId: string): string {
  return crypto
    .createHmac("sha256", process.env.QR_SECRET!)
    .update(serialId)
    .digest("hex")
    .slice(0, 16)
}

// ── Use NEXT_PUBLIC_APP_URL for QR codes ──────────────────────────────────────
// NEXTAUTH_URL is for auth callbacks only — not for public-facing QR URLs
// NEXT_PUBLIC_APP_URL must be set to your production domain in Vercel

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  )
}

export function buildVerifyUrl(serialId: string): string {
  const base = getBaseUrl()
  const sig = signSerial(serialId)
  return `${base}/verify/${serialId}?sig=${sig}`
}

export function buildCapVerifyUrl(
  hiddenSerialId: string,
  bottleSerialId: string
): string {
  const base = getBaseUrl()
  const sig = signSerial(hiddenSerialId)
  return `${base}/verify/cap/${hiddenSerialId}?sig=${sig}&bottle=${bottleSerialId}`
}

export function verifySignature(serialId: string, sig: string): boolean {
  const expected = signSerial(serialId)
  if (sig.length !== expected.length) return false
  return crypto.timingSafeEqual(
    Buffer.from(sig),
    Buffer.from(expected)
  )
}