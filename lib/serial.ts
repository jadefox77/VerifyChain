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

export { formatSerialId } from "@/lib/serial-format"

function signSerial(serialId: string): string {
  return crypto
    .createHmac("sha256", process.env.QR_SECRET!)
    .update(serialId)
    .digest("hex")
    .slice(0, 16)
}

// QR codes use NEXT_PUBLIC_APP_URL. NEXTAUTH_URL is only for auth callbacks,
// so NEXT_PUBLIC_APP_URL must be set to the production domain.

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
  const expected = Buffer.from(signSerial(serialId))
  const given = Buffer.from(sig)
  // Compare byte lengths, not string lengths: a signature with non-ASCII
  // characters can have the right length in characters but not in bytes,
  // and timingSafeEqual throws on buffers of different sizes.
  if (given.length !== expected.length) return false
  return crypto.timingSafeEqual(given, expected)
}