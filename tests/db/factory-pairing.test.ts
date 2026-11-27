import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { signFactoryRequest } from "@/lib/factory-auth"
import { TEST_DB, makeBottle, makeManufacturer, resetDatabase } from "./setup"

// In-memory stand-in for Upstash, so the nonce check runs without Redis.
const seen = new Set<string>()
vi.mock("@/lib/ratelimit", () => ({
  redis: {
    set: async (key: string, _v: unknown, opts: { nx?: boolean }) => {
      if (opts?.nx && seen.has(key)) return null
      seen.add(key)
      return "OK"
    },
  },
}))

const SECRET = "factory-test-secret"

function request(body: object, opts: { nonce: string; timestamp?: number }) {
  const raw = JSON.stringify(body)
  const timestamp = String(opts.timestamp ?? Math.floor(Date.now() / 1000))
  return new NextRequest("http://localhost/api/factory/pairing", {
    method: "POST",
    body: raw,
    headers: {
      "content-type": "application/json",
      "x-factory-timestamp": timestamp,
      "x-factory-nonce": opts.nonce,
      "x-factory-token": signFactoryRequest(SECRET, timestamp, opts.nonce, raw),
    },
  })
}

describe.skipIf(!TEST_DB)("factory pairing replay protection (database)", () => {
  beforeEach(async () => {
    await resetDatabase()
    seen.clear()
    process.env.FACTORY_SECRET = SECRET
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("records a signed pairing once and refuses the same request sent again", async () => {
    const { POST } = await import("@/app/api/factory/pairing/route")
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "LINE1" })
    const body = {
      bottleSerialId: "LINE1",
      topCapCode: "TOP001",
      hiddenSerialId: "HIDDENLINE100001",
      manufacturerId: manufacturer.id,
    }

    const first = await POST(request(body, { nonce: "nonce-aaaaaaaaaaaaaaaa" }))
    expect(first.status).toBe(200)

    const replay = await POST(request(body, { nonce: "nonce-aaaaaaaaaaaaaaaa" }))
    expect(replay.status).toBe(401)
    expect((await replay.json()).code).toBe("REPLAYED")
  })

  it("refuses an old request before touching the database", async () => {
    const { POST } = await import("@/app/api/factory/pairing/route")
    const res = await POST(
      request({ bottleSerialId: "X", manufacturerId: "m" }, { nonce: "nonce-bbbbbbbbbbbbbbbb", timestamp: 1_000_000 })
    )
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe("STALE")
  })
})
