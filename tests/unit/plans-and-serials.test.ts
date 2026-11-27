import { describe, expect, it } from "vitest"
import { describeUsage, monthWindow, PLAN_LIMITS } from "@/lib/plans"
import { buildVerifyUrl, verifySignature } from "@/lib/serial"
import { seeOther } from "@/lib/see-other"

describe("plan usage", () => {
  const limit = PLAN_LIMITS.FREE

  it("warns at 80% and blocks at the limit", () => {
    expect(describeUsage("FREE", 0).state).toBe("ok")
    expect(describeUsage("FREE", Math.ceil(limit * 0.8)).state).toBe("near")
    expect(describeUsage("FREE", limit).state).toBe("over")
    expect(describeUsage("FREE", limit + 5).remaining).toBe(0)
  })

  it("resets at midnight on the 1st, Lagos time (UTC+1)", () => {
    // 23:30 UTC on 31 Jan is 00:30 on 1 Feb in Lagos.
    const { start } = monthWindow(new Date(Date.UTC(2026, 0, 31, 23, 30)))
    expect(start.toISOString()).toBe("2026-01-31T23:00:00.000Z")
  })
})

describe("QR signatures", () => {
  it("accepts the signature built into a QR link", () => {
    const sig = new URL(buildVerifyUrl("ABCD2345EFGH")).searchParams.get("sig")!
    expect(verifySignature("ABCD2345EFGH", sig)).toBe(true)
  })

  it("rejects a signature for another serial", () => {
    const sig = new URL(buildVerifyUrl("ABCD2345EFGH")).searchParams.get("sig")!
    expect(verifySignature("ZZZZ2345EFGH", sig)).toBe(false)
  })

  it("rejects, rather than crashes on, a signature with non-ASCII characters", () => {
    expect(verifySignature("ABCD2345EFGH", "é".repeat(16))).toBe(false)
  })
})

describe("seeOther", () => {
  it("is a 303 with a relative Location", () => {
    const res = seeOther("/admin/users")
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("/admin/users")
  })
})
