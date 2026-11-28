import { describe, expect, it } from "vitest"
import {
  bearerKey,
  bottleToApi,
  capToApi,
  generateApiKey,
  hashApiKey,
  kindOfKey,
  originAllowed,
  parseDomains,
  readBottleId,
  readCode,
  usageBucket,
} from "@/lib/api-keys"

describe("API keys", () => {
  it("makes keys of the right kind, and stores only a hash", () => {
    const sk = generateApiKey("SECRET")
    expect(sk.key.startsWith("vc_sk_")).toBe(true)
    expect(kindOfKey(sk.key)).toBe("SECRET")
    expect(sk.hash).toBe(hashApiKey(sk.key))
    expect(sk.hash).not.toContain(sk.key.slice(6))
    expect(sk.prefix).toBe(sk.key.slice(0, 14))
    expect(kindOfKey(generateApiKey("PUBLISHABLE").key)).toBe("PUBLISHABLE")
  })

  it("never makes the same key twice", () => {
    expect(generateApiKey("SECRET").key).not.toBe(generateApiKey("SECRET").key)
  })

  it("rejects keys of the wrong shape", () => {
    expect(kindOfKey("vc_sk_short")).toBeNull()
    expect(kindOfKey("sk_live_" + "a".repeat(43))).toBeNull()
  })

  it("reads a bearer header", () => {
    expect(bearerKey("Bearer abc")).toBe("abc")
    expect(bearerKey("bearer abc")).toBe("abc")
    expect(bearerKey("Basic abc")).toBeNull()
    expect(bearerKey(null)).toBeNull()
  })
})

describe("allowed domains", () => {
  it("tidies pasted links into hostnames", () => {
    expect(parseDomains("https://Shop.Example.com/path\nexample.com, *.zobo.ng localhost:3000")).toEqual({
      ok: true,
      domains: ["shop.example.com", "example.com", "*.zobo.ng", "localhost"],
    })
  })

  it("refuses things that are not hostnames", () => {
    expect(parseDomains("not a domain!").ok).toBe(false)
    expect(parseDomains("*").ok).toBe(false)
  })

  it("matches exact hosts and subdomain wildcards over https only", () => {
    const domains = ["example.com", "*.zobo.ng", "localhost"]
    expect(originAllowed("https://example.com", domains)).toBe(true)
    expect(originAllowed("https://www.example.com", domains)).toBe(false)
    expect(originAllowed("http://example.com", domains)).toBe(false)
    expect(originAllowed("https://shop.zobo.ng", domains)).toBe(true)
    expect(originAllowed("https://zobo.ng", domains)).toBe(false)
    expect(originAllowed("https://evilzobo.ng", domains)).toBe(false)
    expect(originAllowed("http://localhost:3000", domains)).toBe(true)
    expect(originAllowed(null, domains)).toBe(false)
    expect(originAllowed("null", domains)).toBe(false)
  })
})

describe("reading codes", () => {
  it("reads a scanned bottle link", () => {
    expect(readCode("https://vc.example/verify/ABC123?sig=0123456789abcdef", undefined, "bottle")).toEqual({
      id: "ABC123",
      sig: "0123456789abcdef",
    })
  })

  it("reads a scanned cap link, and not a bottle link as a cap", () => {
    const cap = "https://vc.example/verify/cap/CAPCAPCAP?sig=ff&bottle=ABC"
    expect(readCode(cap, undefined, "cap")).toEqual({ id: "CAPCAPCAP", sig: "ff" })
    expect(readCode(cap, undefined, "bottle")).toBeNull()
    expect(readCode("https://vc.example/verify/ABC123?sig=ff", undefined, "cap")).toBeNull()
  })

  it("needs a signature", () => {
    expect(readCode("https://vc.example/verify/ABC123", undefined, "bottle")).toBeNull()
    expect(readCode("ABC123", undefined, "bottle")).toBeNull()
    expect(readCode("ABC123", "ff", "bottle")).toEqual({ id: "ABC123", sig: "ff" })
  })

  it("reads the bottle a cap is checked against", () => {
    expect(readBottleId("https://vc.example/verify/ABC123?sig=ff")).toBe("ABC123")
    expect(readBottleId("ABC123")).toBe("ABC123")
    expect(readBottleId("bad id!")).toBeUndefined()
  })
})

describe("public statuses", () => {
  const at = new Date("2026-11-28T09:00:00Z")

  it("maps bottle results", () => {
    expect(bottleToApi({ status: "GENUINE_SINGLE", message: "m", productName: "P", authMode: "SINGLE", openedAt: at }).status).toBe("authentic")
    const prompt = bottleToApi({ status: "PROMPT_CAP", message: "m", productName: "P", topCode: "ABC123", authMode: "PAIRED" })
    expect(prompt.status).toBe("scan_cap")
    expect(prompt.next_step).toEqual({ action: "scan_cap", top_code: "ABC123" })
    expect(bottleToApi({ status: "ALREADY_VERIFIED", message: "m", firstScan: at, authMode: "SINGLE" }).check.first_checked_at).toBe(at.toISOString())
    expect(bottleToApi({ status: "CAP_ALREADY_OPENED", message: "m", capOpenedAt: at, authMode: "PAIRED" }).check.reason).toBe("cap_opened_before_label")
    expect(bottleToApi({ status: "NOT_FOUND", message: "m" }).status).toBe("not_found")
  })

  it("maps cap results without leaking internal reasons", () => {
    const paired = capToApi({ status: "GENUINE", message: "m", productName: "P", openedAt: at, pairingChecked: true, outsideRegion: false })
    expect(paired.status).toBe("authentic")
    expect(paired.check.pairing_checked).toBe(true)
    expect(paired.check.outside_target_region).toBe(false)
    expect(capToApi({ status: "WARNING", message: "m", firstOpened: at, firstLocation: null }).status).toBe("already_verified")
    const mismatch = capToApi({ status: "MISMATCH", message: "m", retry: true })
    expect(mismatch.check.reason).toBe("cap_bottle_mismatch")
    expect(mismatch.next_step).toEqual({ action: "scan_bottle" })
    expect(capToApi({ status: "MISMATCH", message: "m", retry: false }).next_step).toBeNull()
    const recheck = capToApi({ status: "ALREADY_CHECKED", message: "m", productName: "P", firstOpened: at })
    expect(recheck.status).toBe("already_verified")
    expect(recheck.check.reason).toBe("same_shopper_recheck")
    const alone = capToApi({ status: "NEEDS_BOTTLE", message: "m" })
    expect(alone.status).toBe("suspicious")
    expect(alone.next_step).toEqual({ action: "scan_bottle" })
    expect(capToApi({ status: "FLAGGED", message: "m", reason: "CAP_BOTTLE_MISMATCH" }).check.reason).toBe("cap_bottle_mismatch")
    const drift = capToApi({ status: "FLAGGED", message: "m", reason: "Supply chain drift: batch intended for Lagos but scanned 900km away" })
    expect(drift.check.reason).toBe("outside_supply_region")
    expect(JSON.stringify(drift)).not.toContain("900km")
  })

  it("never calls a cap authentic when the bottle was not checked", () => {
    const r = capToApi({ status: "GENUINE", message: "m", productName: "P", openedAt: at, pairingChecked: false, outsideRegion: false })
    expect(r.status).toBe("authentic_unpaired")
    expect(r.check.pairing_checked).toBe(false)
    expect(r.check.reason).toBe("bottle_not_checked")
    expect(usageBucket("authentic_unpaired")).toBe("authentic")
  })

  it("passes a product opened out of region, and says so", () => {
    const r = capToApi({ status: "GENUINE", message: "m", productName: "P", openedAt: at, pairingChecked: true, outsideRegion: true })
    expect(r.status).toBe("authentic")
    expect(r.check.outside_target_region).toBe(true)
  })

  it("buckets statuses for usage counts", () => {
    expect(usageBucket("authentic")).toBe("authentic")
    expect(usageBucket("invalid")).toBe("notFound")
    expect(usageBucket("scan_cap")).toBe("warnings")
  })
})
