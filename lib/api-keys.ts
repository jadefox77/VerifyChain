import crypto from "crypto"
import type { VerifyResult } from "@/lib/verify"
import type { CapVerifyResult } from "@/lib/verify-cap"

// Rules for the verification API: key format and hashing, allowed domains,
// reading the scanned code, and turning engine results into the public
// response. Pure, so it can be tested without a database or a request.

export type ApiKeyKindName = "SECRET" | "PUBLISHABLE"

const KEY_PREFIX: Record<ApiKeyKindName, string> = { SECRET: "vc_sk_", PUBLISHABLE: "vc_pk_" }

// 32 random bytes, so keys cannot be guessed. A plain SHA-256 is enough to
// store them: unlike passwords, they have far too much entropy to brute force.
export function generateApiKey(kind: ApiKeyKindName): { key: string; prefix: string; hash: string } {
  const key = KEY_PREFIX[kind] + crypto.randomBytes(32).toString("base64url")
  return { key, prefix: key.slice(0, 14), hash: hashApiKey(key) }
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

export function kindOfKey(key: string): ApiKeyKindName | null {
  if (!/^vc_(sk|pk)_[A-Za-z0-9_-]{43}$/.test(key)) return null
  return key.startsWith("vc_sk_") ? "SECRET" : "PUBLISHABLE"
}

// Reads "Authorization: Bearer <key>".
export function bearerKey(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+(\S+)$/i)
  return m ? m[1] : null
}

// ── Allowed domains ────────────────────────────────────────────────────────

const HOST = /^(\*\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

// One hostname per line or separated by commas or spaces. "https://" and
// paths are stripped. "localhost" is allowed for testing.
export function parseDomains(text: string): { ok: true; domains: string[] } | { ok: false; bad: string } {
  const domains: string[] = []
  for (const raw of text.split(/[\s,]+/)) {
    let d = raw.trim().toLowerCase()
    if (!d) continue
    d = d.replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "")
    if (d !== "localhost" && !HOST.test(d)) return { ok: false, bad: raw.trim() }
    if (!domains.includes(d)) domains.push(d)
  }
  if (domains.length > 20) return { ok: false, bad: "more than 20 domains" }
  return { ok: true, domains }
}

// Does the browser Origin header match one of the allowed hostnames? Only
// https origins count, except localhost for testing. "*.example.com" matches
// subdomains, not example.com itself.
export function originAllowed(origin: string | null, domains: string[]): boolean {
  if (!origin) return false
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  const host = url.hostname.toLowerCase()
  if (host === "localhost") return domains.includes("localhost")
  if (url.protocol !== "https:") return false
  return domains.some((d) => (d.startsWith("*.") ? host.endsWith(d.slice(1)) : host === d))
}

// ── Reading the scanned code ───────────────────────────────────────────────

// Accepts what a QR scanner returns (the full verification link) or the id
// and signature given separately. The signature is always required for the
// code being checked.
export function readCode(
  code: string,
  sig: string | undefined,
  layer: "bottle" | "cap"
): { id: string; sig: string } | null {
  const max = layer === "bottle" ? 20 : 24
  const trimmed = code.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      const parts = url.pathname.split("/").filter(Boolean)
      const id = layer === "bottle" ? (parts[0] === "verify" && parts.length === 2 ? parts[1] : null) : parts[0] === "verify" && parts[1] === "cap" && parts.length === 3 ? parts[2] : null
      const s = url.searchParams.get("sig")
      if (!id || !s || id.length > max) return null
      return { id, sig: s }
    } catch {
      return null
    }
  }
  if (!/^[A-Za-z0-9]{1,24}$/.test(trimmed) || trimmed.length > max || !sig) return null
  return { id: trimmed, sig }
}

// The bottle a cap is checked against. Only the id matters here: the engine
// compares it with the bottle the cap was paired with at the factory.
export function readBottleId(code: string | undefined): string | undefined {
  if (!code) return undefined
  const t = code.trim()
  if (/^https?:\/\//i.test(t)) {
    try {
      const parts = new URL(t).pathname.split("/").filter(Boolean)
      return parts[0] === "verify" && parts.length === 2 && parts[1].length <= 20 ? parts[1] : undefined
    } catch {
      return undefined
    }
  }
  return /^[A-Za-z0-9]{1,20}$/.test(t) ? t : undefined
}

// ── Public response ────────────────────────────────────────────────────────

// authentic_unpaired: the cap is genuine and this is its first opening, but
// no bottle_code was sent, so the refill check (does this cap belong to the
// bottle in the shopper's hand?) was not done.
export type ApiStatus =
  | "authentic"
  | "authentic_unpaired"
  | "scan_cap"
  | "already_verified"
  | "suspicious"
  | "not_found"
  | "invalid"

export type ApiVerification = {
  status: ApiStatus
  message: string
  product: { name: string } | null
  check: {
    layer: "bottle" | "cap"
    auth_mode: "paired" | "single" | null
    first_check: boolean
    pairing_checked: boolean | null
    first_checked_at: string | null
    reason: string | null
    // Opened more than 300 km from the batch's target state. Reported to the
    // brand; on its own it does not fail the check.
    outside_target_region: boolean
  }
  next_step:
    | { action: "scan_cap"; top_code: string | null }
    | { action: "scan_bottle" }
    | null
}

export const INVALID_MESSAGE =
  "This code is not valid. It may have been altered, or the product may not be genuine."

const NOT_FOUND_MESSAGE = "We could not find this code in our records. The product may not be genuine."

const base = (layer: "bottle" | "cap"): ApiVerification["check"] => ({
  layer,
  auth_mode: null,
  first_check: false,
  pairing_checked: null,
  first_checked_at: null,
  reason: null,
  outside_target_region: false,
})

export function invalidResponse(layer: "bottle" | "cap"): ApiVerification {
  return { status: "invalid", message: INVALID_MESSAGE, product: null, check: base(layer), next_step: null }
}

// Also used when a code belongs to another brand, so a key cannot be used to
// learn anything about other brands' products.
export function notFoundResponse(layer: "bottle" | "cap"): ApiVerification {
  return { status: "not_found", message: NOT_FOUND_MESSAGE, product: null, check: base(layer), next_step: null }
}

const iso = (d: Date | string) => new Date(d).toISOString()

export function bottleToApi(r: VerifyResult): ApiVerification {
  const check = base("bottle")
  switch (r.status) {
    case "GENUINE_SINGLE":
      return {
        status: "authentic",
        message: r.message,
        product: { name: r.productName },
        check: { ...check, auth_mode: "single", first_check: true, first_checked_at: iso(r.openedAt) },
        next_step: null,
      }
    case "PROMPT_CAP":
      return {
        status: "scan_cap",
        message: r.message,
        product: { name: r.productName },
        check: { ...check, auth_mode: "paired" },
        next_step: { action: "scan_cap", top_code: r.topCode || null },
      }
    case "ALREADY_VERIFIED":
      return {
        status: "already_verified",
        message: r.message,
        product: null,
        check: { ...check, auth_mode: r.authMode === "SINGLE" ? "single" : "paired", first_checked_at: iso(r.firstScan) },
        next_step: null,
      }
    case "CAP_ALREADY_OPENED":
      return {
        status: "suspicious",
        message: r.message,
        product: null,
        check: { ...check, auth_mode: "paired", first_checked_at: iso(r.capOpenedAt), reason: "cap_opened_before_label" },
        next_step: null,
      }
    case "FLAGGED":
      return { status: "suspicious", message: r.message, product: null, check: { ...check, reason: "flagged" }, next_step: null }
    case "NOT_FOUND":
      return notFoundResponse("bottle")
  }
}

export function capToApi(r: CapVerifyResult): ApiVerification {
  const check = { ...base("cap"), auth_mode: "paired" as const }
  switch (r.status) {
    case "GENUINE":
      return {
        status: r.pairingChecked ? "authentic" : "authentic_unpaired",
        message: r.pairingChecked
          ? r.message
          : `${r.message} The cap was not checked against the bottle label, so a refill cannot be ruled out.`,
        product: { name: r.productName },
        check: {
          ...check,
          first_check: true,
          pairing_checked: r.pairingChecked,
          first_checked_at: iso(r.openedAt),
          reason: r.pairingChecked ? null : "bottle_not_checked",
          outside_target_region: r.outsideRegion,
        },
        next_step: null,
      }
    case "WARNING":
      return {
        status: "already_verified",
        message: r.message,
        product: null,
        check: { ...check, first_checked_at: iso(r.firstOpened), reason: "cap_already_opened" },
        next_step: null,
      }
    case "ALREADY_CHECKED":
      // The same shopper checking again (same IP, or same key when no shopper
      // IP is known) within 24 hours of opening. Nothing was flagged.
      return {
        status: "already_verified",
        message: r.message,
        product: { name: r.productName },
        check: { ...check, first_checked_at: iso(r.firstOpened), reason: "same_shopper_recheck" },
        next_step: null,
      }
    case "NEEDS_BOTTLE":
      // Sent without bottle_code while the cap has an open mismatch alert.
      // Never authentic_unpaired: the cap is still sealed and needs its label.
      return {
        status: "suspicious",
        message: r.message,
        product: null,
        check: { ...check, pairing_checked: false, reason: "cap_bottle_mismatch" },
        next_step: { action: "scan_bottle" },
      }
    case "MISMATCH":
      return {
        status: "suspicious",
        message: r.message,
        product: null,
        check: { ...check, pairing_checked: true, reason: "cap_bottle_mismatch" },
        // The cap is still sealed. First time: ask for the label of the bottle
        // that was actually opened, then send the cap again with it.
        next_step: r.retry ? { action: "scan_bottle" } : null,
      }
    case "FLAGGED":
      return {
        status: "suspicious",
        message: r.message,
        product: null,
        check: {
          ...check,
          reason:
            r.reason === "UNPAIRED_CAP"
              ? "cap_not_paired"
              : r.reason === "CAP_BOTTLE_MISMATCH" // CAP_MISMATCH_FLAG in lib/verify-cap.ts
                ? "cap_bottle_mismatch"
                : "outside_supply_region",
        },
        next_step: null,
      }
    case "NOT_FOUND":
      return notFoundResponse("cap")
  }
}

export type UsageBucket = "authentic" | "warnings" | "notFound" | "rejected"

export function usageBucket(status: ApiStatus): UsageBucket {
  if (status === "authentic" || status === "authentic_unpaired") return "authentic"
  if (status === "not_found" || status === "invalid") return "notFound"
  return "warnings"
}
