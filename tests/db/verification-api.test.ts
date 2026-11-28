import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// No Redis in tests: every rate limit passes.
vi.mock("@/lib/ratelimit", () => ({
  allowRequest: async () => true,
  apiKeyRatelimit: {},
  verifyRatelimit: {},
}))

import { prisma } from "@/lib/prisma"
import { handleVerify } from "@/lib/api-request"
import { generateApiKey } from "@/lib/api-keys"
import { buildCapVerifyUrl, buildVerifyUrl } from "@/lib/serial"
import { TEST_DB, makeBottle, makeManufacturer, resetDatabase } from "./setup"

async function makeKey(manufacturerId: string, kind: "SECRET" | "PUBLISHABLE", allowedDomains: string[] = []) {
  const { key, prefix, hash } = generateApiKey(kind)
  const row = await prisma.apiKey.create({
    data: { manufacturerId, name: "test", kind, prefix, keyHash: hash, allowedDomains },
  })
  return { key, row }
}

function call(path: string, key: string | null, body: unknown, origin?: string) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" }
  if (key) headers.authorization = `Bearer ${key}`
  if (origin) headers.origin = origin
  return new NextRequest(`http://localhost${path}`, { method: "POST", headers, body: JSON.stringify(body) })
}

describe.skipIf(!TEST_DB)("verification API (database)", () => {
  beforeEach(async () => {
    await resetDatabase()
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("checks the brand's own code with the shared engine and records the key", async () => {
    const { manufacturer } = await makeManufacturer()
    const { bottle } = await makeBottle(manufacturer.id, { authMode: "SINGLE", serialId: "APIONE1" })
    const { key, row } = await makeKey(manufacturer.id, "SECRET")

    const res = await handleVerify(call("/api/v1/verify", key, { code: buildVerifyUrl("APIONE1") }), "bottle")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe("authentic")
    expect(body.brand.name).toBe(manufacturer.companyName)

    const scan = await prisma.scanLog.findFirst({ where: { bottleId: bottle.id } })
    expect(scan?.channel).toBe("api")
    expect(scan?.apiKeyId).toBe(row.id)
    // The brand's server IP is not stored as the shopper's
    expect(scan?.ipHash).toBeNull()

    const again = await (await handleVerify(call("/api/v1/verify", key, { code: buildVerifyUrl("APIONE1") }), "bottle")).json()
    expect(again.status).toBe("already_verified")

    // Usage is written after the response
    await vi.waitFor(async () => {
      const usage = await prisma.apiUsageDay.findFirst({ where: { apiKeyId: row.id } })
      expect(usage?.requests).toBe(2)
      expect(usage?.authentic).toBe(1)
      expect(usage?.warnings).toBe(1)
    })
  })

  it("answers not_found for another brand's code and leaves it untouched", async () => {
    const { manufacturer: mine } = await makeManufacturer()
    const { manufacturer: theirs } = await makeManufacturer()
    const { bottle } = await makeBottle(theirs.id, { authMode: "SINGLE", serialId: "THEIRS1" })
    const { key } = await makeKey(mine.id, "SECRET")

    const body = await (await handleVerify(call("/api/v1/verify", key, { code: buildVerifyUrl("THEIRS1") }), "bottle")).json()
    expect(body.status).toBe("not_found")
    expect(await prisma.scanLog.count()).toBe(0)
    expect((await prisma.bottle.findUnique({ where: { id: bottle.id } }))?.status).toBe("MINT")
  })

  it("refuses unsigned codes, revoked keys and missing keys", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "SINGLE", serialId: "APISIG1" })
    const { key, row } = await makeKey(manufacturer.id, "SECRET")

    const unsigned = await (await handleVerify(call("/api/v1/verify", key, { code: "APISIG1", sig: "0000000000000000" }), "bottle")).json()
    expect(unsigned.status).toBe("invalid")

    expect((await handleVerify(call("/api/v1/verify", null, { code: "x" }), "bottle")).status).toBe(401)

    await prisma.apiKey.update({ where: { id: row.id }, data: { revokedAt: new Date() } })
    const revoked = await handleVerify(call("/api/v1/verify", key, { code: buildVerifyUrl("APISIG1") }), "bottle")
    expect(revoked.status).toBe(401)
    expect(await prisma.scanLog.count()).toBe(0)
  })

  it("keeps secret keys off browsers and publishable keys on their domains", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "SINGLE", serialId: "APIDOM1" })
    const secret = await makeKey(manufacturer.id, "SECRET")
    const pub = await makeKey(manufacturer.id, "PUBLISHABLE", ["shop.zobo.ng"])
    const code = { code: buildVerifyUrl("APIDOM1") }

    const fromBrowser = await handleVerify(call("/api/v1/verify", secret.key, code, "https://shop.zobo.ng"), "bottle")
    expect(fromBrowser.status).toBe(403)
    expect((await fromBrowser.json()).error.code).toBe("secret_key_in_browser")

    const wrongSite = await handleVerify(call("/api/v1/verify", pub.key, code, "https://copycat.example"), "bottle")
    expect(wrongSite.status).toBe(403)
    expect(await prisma.scanLog.count()).toBe(0)

    const ok = await handleVerify(call("/api/v1/verify", pub.key, code, "https://shop.zobo.ng"), "bottle")
    expect(ok.status).toBe(200)
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://shop.zobo.ng")
    const scan = await prisma.scanLog.findFirst()
    expect(scan?.ipHash).not.toBeNull()
  })

  it("runs the two-code flow: label, then cap with the label as bottle_code", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "APICAP1", withCap: "CAPAPICAP1XXXXXX" })
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "APICAP2", withCap: "CAPAPICAP2XXXXXX" })
    const { key } = await makeKey(manufacturer.id, "SECRET")

    const label = await (await handleVerify(call("/api/v1/verify", key, { code: buildVerifyUrl("APICAP1") }), "bottle")).json()
    expect(label.status).toBe("scan_cap")

    const cap = await (
      await handleVerify(
        call("/api/v1/verify/cap", key, {
          code: buildCapVerifyUrl("CAPAPICAP1XXXXXX", "APICAP1"),
          bottle_code: buildVerifyUrl("APICAP1"),
        }),
        "cap"
      )
    ).json()
    expect(cap.status).toBe("authentic")
    expect(cap.check.pairing_checked).toBe(true)

    // A cap from a different bottle is caught
    const swapped = await (
      await handleVerify(
        call("/api/v1/verify/cap", key, { code: buildCapVerifyUrl("CAPAPICAP2XXXXXX", "APICAP2"), bottle_code: "APICAP1" }),
        "cap"
      )
    ).json()
    expect(swapped.status).toBe("suspicious")
    expect(swapped.check.reason).toBe("cap_bottle_mismatch")
  })
})
