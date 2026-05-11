import { customAlphabet } from "nanoid"
import crypto from "crypto"

const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const generate = customAlphabet(alphabet, 12)

export function generateSerialId(): string {
  return generate()
}

export function formatSerialId(serialId: string): string {
  return `${serialId.slice(0, 4)}-${serialId.slice(4, 8)}-${serialId.slice(8, 12)}`
}

function signSerial(serialId: string): string {
  return crypto
    .createHmac("sha256", process.env.QR_SECRET!)
    .update(serialId)
    .digest("hex")
    .slice(0, 16)
}

export function buildVerifyUrl(serialId: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  const sig = signSerial(serialId)
  return `${base}/verify/${serialId}?sig=${sig}`
}

export function verifySignature(serialId: string, sig: string): boolean {
  const expected = signSerial(serialId)
  return crypto.timingSafeEqual(
    Buffer.from(sig),
    Buffer.from(expected)
  )
}