import { describe, expect, it } from "vitest"
import {
  FACTORY_MAX_SKEW_SECONDS,
  checkFactoryRequest,
  signFactoryRequest,
  signLegacyFactoryRequest,
} from "@/lib/factory-auth"

const SECRET = "factory-test-secret"
const NOW = 1_800_000_000
const BODY = JSON.stringify({ bottleSerialId: "ABCD2345EFGH", manufacturerId: "m1" })
const NONCE = "0123456789abcdef0123"

function signed(over: Partial<Parameters<typeof checkFactoryRequest>[0]> = {}) {
  const timestamp = String(NOW)
  return {
    secret: SECRET,
    timestamp,
    nonce: NONCE,
    token: signFactoryRequest(SECRET, timestamp, NONCE, BODY),
    rawBody: BODY,
    nowSeconds: NOW,
    allowLegacy: false,
    ...over,
  }
}

describe("checkFactoryRequest", () => {
  it("accepts a fresh, correctly signed request", () => {
    expect(checkFactoryRequest(signed())).toEqual({ ok: true, nonce: NONCE, legacy: false })
  })

  it("refuses a request replayed after the 5 minute window", () => {
    const r = checkFactoryRequest(signed({ nowSeconds: NOW + FACTORY_MAX_SKEW_SECONDS + 1 }))
    expect(r).toEqual({ ok: false, reason: "stale" })
  })

  it("refuses a timestamp from the future beyond the window", () => {
    expect(checkFactoryRequest(signed({ nowSeconds: NOW - FACTORY_MAX_SKEW_SECONDS - 1 }))).toEqual({
      ok: false,
      reason: "stale",
    })
  })

  it("refuses a changed body, timestamp or nonce under the same token", () => {
    expect(checkFactoryRequest(signed({ rawBody: BODY.replace("m1", "m2") })).ok).toBe(false)
    expect(checkFactoryRequest(signed({ timestamp: String(NOW + 1) })).ok).toBe(false)
    expect(checkFactoryRequest(signed({ nonce: "fedcba9876543210fedc" })).ok).toBe(false)
  })

  it("refuses a request signed with another secret", () => {
    expect(checkFactoryRequest(signed({ secret: "other" }))).toEqual({ ok: false, reason: "bad_signature" })
  })

  it("refuses short or odd nonces, and missing headers", () => {
    expect(checkFactoryRequest(signed({ nonce: "short" }))).toEqual({ ok: false, reason: "bad_nonce" })
    expect(checkFactoryRequest(signed({ nonce: null }))).toEqual({ ok: false, reason: "missing_headers" })
    expect(checkFactoryRequest(signed({ token: null }))).toEqual({ ok: false, reason: "missing_headers" })
    expect(checkFactoryRequest(signed({ secret: undefined }))).toEqual({ ok: false, reason: "not_configured" })
  })

  it("refuses the old body-only signature unless the transition flag is on", () => {
    const legacy = {
      ...signed({ timestamp: null, nonce: null }),
      token: signLegacyFactoryRequest(SECRET, BODY),
    }
    expect(checkFactoryRequest(legacy).ok).toBe(false)
    expect(checkFactoryRequest({ ...legacy, allowLegacy: true })).toEqual({ ok: true, nonce: null, legacy: true })
  })

  it("does not crash on a token with non-ASCII characters", () => {
    expect(checkFactoryRequest(signed({ token: "é".repeat(64) })).ok).toBe(false)
  })
})
