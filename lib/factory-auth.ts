import crypto from "crypto"

// Signing for factory scanner requests to POST /api/factory/pairing.
//
// The scanner sends three headers:
//   X-Factory-Timestamp  Unix time in seconds when the request was made
//   X-Factory-Nonce      A random value used once (16 to 64 letters, digits, - or _)
//   X-Factory-Token      hex HMAC-SHA256 of "<timestamp>.<nonce>.<raw body>" with FACTORY_SECRET
//
// The server rejects requests more than 5 minutes old (or from the future),
// and any nonce it has already seen, so a captured request cannot be sent
// again. The body is signed exactly as sent, not re-serialised.

export const FACTORY_MAX_SKEW_SECONDS = 5 * 60
// Nonces are remembered a little longer than the accepted window.
export const FACTORY_NONCE_TTL_SECONDS = 10 * 60
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

export function signFactoryRequest(secret: string, timestamp: string, nonce: string, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${nonce}.${rawBody}`).digest("hex")
}

// The scheme before replay protection: HMAC of the body alone. Accepted only
// while FACTORY_ALLOW_LEGACY_SIGNATURE=true, to give scanners time to update.
export function signLegacyFactoryRequest(secret: string, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
}

function safeEqualHex(expected: string, given: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export type FactoryCheck =
  | { ok: true; nonce: string | null; legacy: boolean }
  | { ok: false; reason: "not_configured" | "missing_headers" | "bad_nonce" | "stale" | "bad_signature" }

// Checks the signature and the time window. The caller must still check the
// nonce has not been used before (see claimNonce in the route).
export function checkFactoryRequest(input: {
  secret: string | undefined
  timestamp: string | null
  nonce: string | null
  token: string | null
  rawBody: string
  nowSeconds: number
  allowLegacy: boolean
}): FactoryCheck {
  const { secret, timestamp, nonce, token, rawBody, nowSeconds, allowLegacy } = input
  if (!secret) return { ok: false, reason: "not_configured" }
  if (!token) return { ok: false, reason: "missing_headers" }

  if (!timestamp && !nonce) {
    if (allowLegacy && safeEqualHex(signLegacyFactoryRequest(secret, rawBody), token)) {
      return { ok: true, nonce: null, legacy: true }
    }
    return { ok: false, reason: allowLegacy ? "bad_signature" : "missing_headers" }
  }
  if (!timestamp || !nonce) return { ok: false, reason: "missing_headers" }
  if (!NONCE_PATTERN.test(nonce)) return { ok: false, reason: "bad_nonce" }
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "stale" }
  if (Math.abs(nowSeconds - Number(timestamp)) > FACTORY_MAX_SKEW_SECONDS) return { ok: false, reason: "stale" }

  if (!safeEqualHex(signFactoryRequest(secret, timestamp, nonce, rawBody), token)) {
    return { ok: false, reason: "bad_signature" }
  }
  return { ok: true, nonce, legacy: false }
}
