import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { verifyBottle } from "@/lib/verify"
import { verifyCapDetailed } from "@/lib/verify-cap"
import { runFraudPipeline } from "@/lib/fraud-pipeline"
import { DRIFT_HARD_FLAG_BOTTLES } from "@/lib/regions"
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

  it("catches a mismatch but leaves the cap sealed, offers a retry and alerts the brand", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "REAL1", withCap: "CAPREAL1XXXXXXXX" })
    const other = await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "OTHER1", withCap: "CAPOTHER1XXXXXXX" })
    const meta = { deviceHash: "phone-shelf" }

    // Scanned the shelf label REAL1, bought and opened OTHER1.
    const first = await verifyCapDetailed({ hiddenSerialId: "CAPOTHER1XXXXXXX", bottleSerialIds: ["REAL1"], meta })
    expect(first.result.status).toBe("MISMATCH")
    if (first.result.status === "MISMATCH") expect(first.result.retry).toBe(true)

    const cap = await prisma.cap.findUniqueOrThrow({ where: { hiddenSerialId: "CAPOTHER1XXXXXXX" } })
    expect(cap.status).toBe("SEALED")
    expect(cap.openedAt).toBeNull()
    expect((await prisma.bottle.findUniqueOrThrow({ where: { id: other.bottle.id } })).status).toBe("MINT")
    const firstLog = await prisma.scanLog.findFirstOrThrow({ where: { capId: cap.id } })
    expect(firstLog.fraudFlag).toBe(false)

    const alert = await prisma.alertLog.findFirstOrThrow({ where: { type: "INVALID_PAIRING" } })
    expect(alert.severity).toBe("SUSPICIOUS")
    expect(alert.manufacturerId).toBe(manufacturer.id)

    // The label of the bottle they opened: genuine, and a later label scan is fine too.
    const retry = await verifyCapDetailed({ hiddenSerialId: "CAPOTHER1XXXXXXX", bottleSerialIds: ["REAL1", "OTHER1"], meta })
    expect(retry.result.status).toBe("GENUINE")
    expect((await verifyBottle({ serialId: "REAL1" })).status).toBe("PROMPT_CAP")
  })

  it("flags the cap on a second mismatch from the same phone, and keeps refusing it", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "LABEL2", withCap: "CAPLABEL2XXXXXXX" })
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "SWAP2", withCap: "CAPSWAP2XXXXXXXX" })
    const meta = { deviceHash: "phone-swap" }

    await verifyCapDetailed({ hiddenSerialId: "CAPSWAP2XXXXXXXX", bottleSerialIds: ["LABEL2"], meta })
    const second = await verifyCapDetailed({ hiddenSerialId: "CAPSWAP2XXXXXXXX", bottleSerialIds: ["LABEL2"], meta })
    expect(second.result.status).toBe("MISMATCH")
    if (second.result.status === "MISMATCH") expect(second.result.retry).toBe(false)

    const cap = await prisma.cap.findUniqueOrThrow({ where: { hiddenSerialId: "CAPSWAP2XXXXXXXX" } })
    expect(cap.status).toBe("FLAGGED")
    expect(cap.openedAt).toBeNull()

    // Later, alone or from another browser, or even with its own label: refused.
    const alone = await verifyCapDetailed({ hiddenSerialId: "CAPSWAP2XXXXXXXX", capLinkBottleId: "SWAP2" })
    expect(alone.result.status).toBe("FLAGGED")
    const own = await verifyCapDetailed({ hiddenSerialId: "CAPSWAP2XXXXXXXX", bottleSerialIds: ["SWAP2"], meta: { deviceHash: "phone-new" } })
    expect(own.result.status).toBe("FLAGGED")
    expect((await verifyBottle({ serialId: "SWAP2" })).status).toBe("FLAGGED")

    const alerts = await prisma.alertLog.findMany({ where: { type: "INVALID_PAIRING" } })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].severity).toBe("HIGH_CONCERN")
    expect(alerts[0].affectedCount).toBe(2)
    expect(await prisma.scanLog.count({ where: { capId: cap.id, fraudFlag: true } })).toBe(3)
  })

  it("will not pass a cap scanned alone while its mismatch alert is open", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "SHELF3", withCap: "CAPSHELF3XXXXXXX" })
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "OPEN3", withCap: "CAPOPEN3XXXXXXXX" })

    await verifyCapDetailed({ hiddenSerialId: "CAPOPEN3XXXXXXXX", bottleSerialIds: ["SHELF3"], meta: { deviceHash: "phone-a" } })

    // Bottle list expired, or another browser: only the cap link's own bottle id.
    const alone = await verifyCapDetailed({ hiddenSerialId: "CAPOPEN3XXXXXXXX", capLinkBottleId: "OPEN3", meta: { deviceHash: "phone-b" } })
    expect(alone.result.status).toBe("NEEDS_BOTTLE")
    // No bottle at all (as the API without bottle_code)
    expect((await verifyCapDetailed({ hiddenSerialId: "CAPOPEN3XXXXXXXX" })).result.status).toBe("NEEDS_BOTTLE")
    const cap = await prisma.cap.findUniqueOrThrow({ where: { hiddenSerialId: "CAPOPEN3XXXXXXXX" } })
    expect(cap.status).toBe("SEALED")

    // With the right label it still passes.
    const right = await verifyCapDetailed({ hiddenSerialId: "CAPOPEN3XXXXXXXX", bottleSerialIds: ["OPEN3"], meta: { deviceHash: "phone-b" } })
    expect(right.result.status).toBe("GENUINE")
  })

  it("still passes a cap scanned alone once staff resolve its mismatch alert", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "SHELF4", withCap: "CAPSHELF4XXXXXXX" })
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "OPEN4", withCap: "CAPOPEN4XXXXXXXX" })
    await verifyCapDetailed({ hiddenSerialId: "CAPOPEN4XXXXXXXX", bottleSerialIds: ["SHELF4"] })
    await prisma.alertLog.updateMany({ where: { type: "INVALID_PAIRING" }, data: { resolved: true, resolvedAt: new Date() } })

    const alone = await verifyCapDetailed({ hiddenSerialId: "CAPOPEN4XXXXXXXX", capLinkBottleId: "OPEN4" })
    expect(alone.result.status).toBe("GENUINE")
    if (alone.result.status === "GENUINE") expect(alone.result.pairingChecked).toBe(false)
  })

  it("passes one product opened out of region, records the drift and alerts the brand", async () => {
    const { manufacturer } = await makeManufacturer()
    const { bottle } = await makeBottle(manufacturer.id, {
      authMode: "PAIRED", serialId: "LAGOS1", targetRegion: "Lagos", withCap: "CAPLAGOS1XXXXXXX",
    })

    // Opened in Kano, about 800 km from Lagos.
    const { result } = await verifyCapDetailed({
      hiddenSerialId: "CAPLAGOS1XXXXXXX", bottleSerialIds: ["LAGOS1"], lat: 12.0, lng: 8.59,
    })
    expect(result.status).toBe("GENUINE")
    if (result.status === "GENUINE") expect(result.outsideRegion).toBe(true)

    expect((await prisma.bottle.findUniqueOrThrow({ where: { id: bottle.id } })).status).toBe("OPENED")
    expect((await prisma.cap.findUniqueOrThrow({ where: { hiddenSerialId: "CAPLAGOS1XXXXXXX" } })).status).toBe("OPENED")
    const log = await prisma.scanLog.findFirstOrThrow({ where: { bottleId: bottle.id, scanLayer: "CAP" } })
    expect(log.fraudFlag).toBe(false)
    expect(log.flagReason).toMatch(/^Supply chain drift/)

    const alert = await prisma.alertLog.findFirstOrThrow({ where: { type: "SUPPLY_CHAIN_DRIFT" } })
    expect(alert.severity).toBe("SUSPICIOUS")

    // The nightly job does not raise a second alert for the same batch.
    await runFraudPipeline()
    expect(await prisma.alertLog.count({ where: { type: "SUPPLY_CHAIN_DRIFT" } })).toBe(1)
  })

  it("hard-flags only repeated drift in one batch, and starts again once the alert is resolved", async () => {
    const { manufacturer } = await makeManufacturer()
    const first = await makeBottle(manufacturer.id, {
      authMode: "PAIRED", serialId: "DRIFTB00", targetRegion: "Lagos", withCap: "CAPDRIFTB00XXXXX",
    })
    const batchId = first.batch.id
    const addBottle = async (n: number) => {
      const serialId = `DRIFTB${String(n).padStart(2, "0")}`
      const b = await prisma.bottle.create({
        data: { serialId, batchId, manufacturerId: manufacturer.id, hmacSig: "test" },
      })
      await prisma.cap.create({
        data: { bottleId: b.id, topCode: `T${String(n).padStart(5, "0")}`, hiddenSerialId: `CAP${serialId}XXXXX`, hiddenHmacSig: "test" },
      })
      return serialId
    }
    const openInKano = (serialId: string) =>
      verifyCapDetailed({ hiddenSerialId: `CAP${serialId}XXXXX`, bottleSerialIds: [serialId], lat: 12.0, lng: 8.59 })

    // DRIFT_HARD_FLAG_BOTTLES (10) bottles opened out of region all pass.
    const passed = [await openInKano("DRIFTB00")]
    for (let n = 1; n < DRIFT_HARD_FLAG_BOTTLES; n++) passed.push(await openInKano(await addBottle(n)))
    expect(passed.every((p) => p.result.status === "GENUINE")).toBe(true)

    // The next one is flagged.
    const flaggedSerial = await addBottle(DRIFT_HARD_FLAG_BOTTLES)
    const flagged = await openInKano(flaggedSerial)
    expect(flagged.result.status).toBe("FLAGGED")
    expect((await prisma.bottle.findUniqueOrThrow({ where: { serialId: flaggedSerial } })).status).toBe("FLAGGED")
    const alert = await prisma.alertLog.findFirstOrThrow({ where: { type: "SUPPLY_CHAIN_DRIFT", batchId } })
    expect(alert.severity).toBe("HIGH_CONCERN")

    // Staff mark the movement as known: the count starts again.
    await prisma.alertLog.update({ where: { id: alert.id }, data: { resolved: true, resolvedAt: new Date() } })
    const after = await openInKano(await addBottle(DRIFT_HARD_FLAG_BOTTLES + 1))
    expect(after.result.status).toBe("GENUINE")
  })

  it("lets a shopper re-scan the label of a genuine bottle without flagging it", async () => {
    const { manufacturer } = await makeManufacturer()
    const { bottle } = await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "RESCAN1", withCap: "CAPRESCAN1XXXXXX" })

    expect((await verifyBottle({ serialId: "RESCAN1", meta: { deviceHash: "phone-a" } })).status).toBe("PROMPT_CAP")
    const cap = await verifyCapDetailed({ hiddenSerialId: "CAPRESCAN1XXXXXX", bottleSerialIds: ["RESCAN1"], meta: { deviceHash: "phone-a" } })
    expect(cap.result.status).toBe("GENUINE")

    // Shown to a friend later
    const again = await verifyBottle({ serialId: "RESCAN1", meta: { deviceHash: "phone-a" } })
    expect(again.status).toBe("ALREADY_VERIFIED")
    expect((await prisma.bottle.findUniqueOrThrow({ where: { id: bottle.id } })).status).toBe("OPENED")
    expect((await prisma.cap.findUniqueOrThrow({ where: { hiddenSerialId: "CAPRESCAN1XXXXXX" } })).status).toBe("OPENED")
    expect(await prisma.scanLog.count({ where: { bottleId: bottle.id, fraudFlag: true } })).toBe(0)
  })

  it("still warns about a cap opened while its bottle was never checked", async () => {
    const { manufacturer } = await makeManufacturer()
    const { bottle } = await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "ODD1", withCap: "CAPODD1XXXXXXXXX" })
    await prisma.cap.update({ where: { hiddenSerialId: "CAPODD1XXXXXXXXX" }, data: { status: "OPENED", openedAt: new Date() } })

    expect((await verifyBottle({ serialId: "ODD1" })).status).toBe("CAP_ALREADY_OPENED")
    expect((await prisma.bottle.findUniqueOrThrow({ where: { id: bottle.id } })).status).toBe("FLAGGED")
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
