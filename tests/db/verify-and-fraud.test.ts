import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { verifyBottle } from "@/lib/verify"
import { verifyCapDetailed } from "@/lib/verify-cap"
import { runFraudPipeline } from "@/lib/fraud-pipeline"
import { TEST_DB, makeBottle, makeManufacturer, resetDatabase } from "./setup"

// Skipped unless TEST_DATABASE_URL is set (CI sets it to a Postgres service).
describe.skipIf(!TEST_DB)("verification and fraud rules (database)", () => {
  beforeEach(async () => {
    await resetDatabase()
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("accepts a cap that belongs to any bottle scanned recently, as with a crate", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "CRATE1", withCap: "CAPCRATE1XXXXXXX" })
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "CRATE2", withCap: "CAPCRATE2XXXXXXX" })

    // Scanned CRATE1 then CRATE2, now opening CRATE1.
    const { result, capBottleSerialId } = await verifyCapDetailed({
      hiddenSerialId: "CAPCRATE1XXXXXXX",
      bottleSerialIds: ["CRATE2", "CRATE1"],
    })
    expect(result.status).toBe("GENUINE")
    expect(capBottleSerialId).toBe("CRATE1")
  })

  it("still catches a cap that belongs to none of the scanned bottles", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "REAL1", withCap: "CAPREAL1XXXXXXXX" })
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "OTHER1", withCap: "CAPOTHER1XXXXXXX" })

    const { result } = await verifyCapDetailed({
      hiddenSerialId: "CAPOTHER1XXXXXXX",
      bottleSerialIds: ["REAL1"],
    })
    expect(result.status).toBe("MISMATCH")
  })

  it("reports the first scan time for a reused single-mode code, not the last status change", async () => {
    const { manufacturer } = await makeManufacturer()
    const { bottle } = await makeBottle(manufacturer.id, { authMode: "SINGLE", serialId: "SINGLE1" })

    const first = await verifyBottle({ serialId: "SINGLE1", meta: { deviceHash: "phone-a" } })
    expect(first.status).toBe("GENUINE_SINGLE")
    const firstLog = await prisma.scanLog.findFirstOrThrow({ where: { bottleId: bottle.id } })

    // Something else touches the bottle later (updatedAt moves).
    await prisma.bottle.update({ where: { id: bottle.id }, data: { status: "OPENED" } })

    const second = await verifyBottle({ serialId: "SINGLE1", meta: { deviceHash: "phone-b" } })
    expect(second.status).toBe("ALREADY_VERIFIED")
    if (second.status === "ALREADY_VERIFIED") {
      expect(new Date(second.firstScan).getTime()).toBe(firstLog.scannedAt.getTime())
    }
  })

  it("raises no alert for one honest customer, and the right alerts for fraud", async () => {
    const { manufacturer } = await makeManufacturer()
    const now = Date.now()

    // One phone: three label taps and a cap scan 3 km away, seconds apart.
    const honest = await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "HONEST1", targetRegion: "Kano" })
    for (let i = 0; i < 3; i++) {
      await prisma.scanLog.create({
        data: {
          bottleId: honest.bottle.id, batchId: honest.batch.id, manufacturerId: manufacturer.id,
          scanLayer: "BOTTLE", deviceHash: "phone-honest", lat: 12.0, lng: 8.59,
          scannedAt: new Date(now - 60_000 + i * 1000),
        },
      })
    }
    await prisma.scanLog.create({
      data: {
        bottleId: honest.bottle.id, batchId: honest.batch.id, manufacturerId: manufacturer.id,
        scanLayer: "CAP", deviceHash: "phone-honest", lat: 12.03, lng: 8.6,
        scannedAt: new Date(now - 50_000),
      },
    })

    // A copied single-mode code: scanned by two different phones.
    const copied = await makeBottle(manufacturer.id, { authMode: "SINGLE", serialId: "COPIED1" })
    for (const deviceHash of ["phone-1", "phone-2"]) {
      await prisma.scanLog.create({
        data: { bottleId: copied.bottle.id, batchId: copied.batch.id, manufacturerId: manufacturer.id, scanLayer: "BOTTLE", deviceHash },
      })
    }

    // A Lagos batch scanned in Kano.
    const drifted = await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "DRIFT1", targetRegion: "Lagos" })
    await prisma.scanLog.create({
      data: {
        bottleId: drifted.bottle.id, batchId: drifted.batch.id, manufacturerId: manufacturer.id,
        scanLayer: "BOTTLE", deviceHash: "phone-drift", lat: 12.0, lng: 8.59,
      },
    })

    // A bot: 60 scans in 90 seconds, five hours before the job runs.
    for (let i = 0; i < 60; i++) {
      await prisma.scanLog.create({
        data: {
          bottleId: copied.bottle.id, batchId: copied.batch.id, manufacturerId: manufacturer.id,
          scanLayer: "BOTTLE", deviceHash: "bot", scannedAt: new Date(now - 5 * 3600_000 + i * 1500),
        },
      })
    }

    const result = await runFraudPipeline()
    const alerts = await prisma.alertLog.findMany({ select: { type: true, message: true } })
    const types = alerts.map((a) => a.type).sort()

    expect(types).toEqual(["BOT_ACTIVITY", "MASS_CLONING", "SUPPLY_CHAIN_DRIFT"])
    expect(alerts.some((a) => a.message.includes("HONEST1"))).toBe(false)
    expect(result.alerts_created).toBe(3)

    // Running again does not duplicate open alerts.
    const again = await runFraudPipeline()
    expect(again.alerts_created).toBe(0)
  })
})
