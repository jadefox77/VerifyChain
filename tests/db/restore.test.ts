import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { verifyBottle } from "@/lib/verify"
import { verifyCapDetailed } from "@/lib/verify-cap"
import { restoreFromAlert } from "@/lib/restore"
import { DRIFT_HARD_FLAG_BOTTLES } from "@/lib/regions"
import { TEST_DB, makeBottle, makeManufacturer, resetDatabase } from "./setup"

async function makeStaff() {
  return prisma.user.create({ data: { email: `staff${Date.now()}@test.local`, role: "FRAUD_ANALYST" } })
}

describe.skipIf(!TEST_DB)("restoring flagged products (database)", () => {
  beforeEach(async () => {
    await resetDatabase()
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("puts a cap flagged by a repeated mismatch back to sealed, with a reason in the audit log", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "WRONG1", withCap: "CAPWRONG1XXXXXXX" })
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "MINE1", withCap: "CAPMINE1XXXXXXXX" })
    const meta = { deviceHash: "confused-phone" }

    // An honest but confused shopper scans the wrong label twice.
    await verifyCapDetailed({ hiddenSerialId: "CAPMINE1XXXXXXXX", bottleSerialIds: ["WRONG1"], meta })
    await verifyCapDetailed({ hiddenSerialId: "CAPMINE1XXXXXXXX", bottleSerialIds: ["WRONG1"], meta })
    expect((await prisma.cap.findUniqueOrThrow({ where: { hiddenSerialId: "CAPMINE1XXXXXXXX" } })).status).toBe("FLAGGED")
    const alert = await prisma.alertLog.findFirstOrThrow({ where: { type: "INVALID_PAIRING" } })
    const staff = await makeStaff()

    // A reason is required
    expect(await restoreFromAlert(alert.id, staff.id, "  ")).toEqual({ ok: false, error: "bad_reason" })

    const result = await restoreFromAlert(alert.id, staff.id, "Shopper sent photos of the bottle, wrong shelf label scanned")
    expect(result).toEqual({ ok: true, restored: 1 })
    expect((await prisma.cap.findUniqueOrThrow({ where: { hiddenSerialId: "CAPMINE1XXXXXXXX" } })).status).toBe("SEALED")
    const resolved = await prisma.alertLog.findUniqueOrThrow({ where: { id: alert.id } })
    expect(resolved.resolved).toBe(true)
    expect(resolved.resolvedBy).toBe(staff.id)

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "PRODUCTS_RESTORED" } })
    expect(audit.userId).toBe(staff.id)
    expect(audit.targetId).toBe(alert.id)
    expect(JSON.parse(audit.after ?? "{}").reason).toContain("wrong shelf label")
    expect(JSON.parse(audit.before ?? "{}").products[0].cap).toBe("FLAGGED")

    // The label works again, and one more wrong label gets a fresh retry, not a flag.
    expect((await verifyBottle({ serialId: "MINE1" })).status).toBe("PROMPT_CAP")
    const again = await verifyCapDetailed({ hiddenSerialId: "CAPMINE1XXXXXXXX", bottleSerialIds: ["WRONG1"], meta })
    expect(again.result.status).toBe("MISMATCH")
    if (again.result.status === "MISMATCH") expect(again.result.retry).toBe(true)
    const right = await verifyCapDetailed({ hiddenSerialId: "CAPMINE1XXXXXXXX", bottleSerialIds: ["MINE1"], meta })
    expect(right.result.status).toBe("GENUINE")
  })

  it("leaves an opened cap and the bottle alone when restoring a mismatch alert", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "WRONG2", withCap: "CAPWRONG2XXXXXXX" })
    const { bottle } = await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "MINE2", withCap: "CAPMINE2XXXXXXXX" })
    await verifyCapDetailed({ hiddenSerialId: "CAPMINE2XXXXXXXX", bottleSerialIds: ["WRONG2"] })
    const alert = await prisma.alertLog.findFirstOrThrow({ where: { type: "INVALID_PAIRING" } })

    // Later flagged for another reason: opened, then reused.
    await prisma.cap.update({ where: { hiddenSerialId: "CAPMINE2XXXXXXXX" }, data: { status: "FLAGGED", openedAt: new Date() } })
    await prisma.bottle.update({ where: { id: bottle.id }, data: { status: "FLAGGED" } })

    const staff = await makeStaff()
    const result = await restoreFromAlert(alert.id, staff.id, "Checking restore scope")
    expect(result).toEqual({ ok: true, restored: 0 })
    expect((await prisma.cap.findUniqueOrThrow({ where: { hiddenSerialId: "CAPMINE2XXXXXXXX" } })).status).toBe("FLAGGED")
    expect((await prisma.bottle.findUniqueOrThrow({ where: { id: bottle.id } })).status).toBe("FLAGGED")
  })

  it("puts products flagged by repeated drift back to opened, and only those", async () => {
    const { manufacturer } = await makeManufacturer()
    const first = await makeBottle(manufacturer.id, {
      authMode: "PAIRED", serialId: "RDRIFT00", targetRegion: "Lagos", withCap: "CAPRDRIFT00XXXXX",
    })
    const batchId = first.batch.id
    const add = async (n: number) => {
      const serialId = `RDRIFT${String(n).padStart(2, "0")}`
      const b = await prisma.bottle.create({ data: { serialId, batchId, manufacturerId: manufacturer.id, hmacSig: "test" } })
      await prisma.cap.create({
        data: { bottleId: b.id, topCode: `R${String(n).padStart(5, "0")}`, hiddenSerialId: `CAP${serialId}XXXXX`, hiddenHmacSig: "test" },
      })
      return serialId
    }
    const openInKano = (serialId: string) =>
      verifyCapDetailed({ hiddenSerialId: `CAP${serialId}XXXXX`, bottleSerialIds: [serialId], lat: 12.0, lng: 8.59 })

    await openInKano("RDRIFT00")
    for (let n = 1; n < DRIFT_HARD_FLAG_BOTTLES; n++) await openInKano(await add(n))
    const flaggedSerial = await add(DRIFT_HARD_FLAG_BOTTLES)
    expect((await openInKano(flaggedSerial)).result.status).toBe("FLAGGED")

    // A bottle in the same batch flagged for another reason is not touched.
    const otherSerial = await add(DRIFT_HARD_FLAG_BOTTLES + 1)
    await prisma.bottle.update({ where: { serialId: otherSerial }, data: { status: "FLAGGED" } })

    const alert = await prisma.alertLog.findFirstOrThrow({ where: { type: "SUPPLY_CHAIN_DRIFT", batchId } })
    const staff = await makeStaff()
    const result = await restoreFromAlert(alert.id, staff.id, "Distributor confirmed the transfer to Kano")
    expect(result).toEqual({ ok: true, restored: 1 })

    expect((await prisma.bottle.findUniqueOrThrow({ where: { serialId: flaggedSerial } })).status).toBe("OPENED")
    expect((await prisma.cap.findUniqueOrThrow({ where: { hiddenSerialId: `CAP${flaggedSerial}XXXXX` } })).status).toBe("OPENED")
    expect((await prisma.bottle.findUniqueOrThrow({ where: { serialId: otherSerial } })).status).toBe("FLAGGED")

    // Once resolved, there is nothing left to restore
    expect(await restoreFromAlert(alert.id, staff.id, "Second click")).toEqual({ ok: false, error: "nothing_to_restore" })
  })

  it("refuses other alert types", async () => {
    const { manufacturer } = await makeManufacturer()
    const alert = await prisma.alertLog.create({
      data: { type: "BOT_ACTIVITY", severity: "HIGH_CONCERN", manufacturerId: manufacturer.id, message: "m" },
    })
    const staff = await makeStaff()
    expect(await restoreFromAlert(alert.id, staff.id, "A proper reason")).toEqual({ ok: false, error: "wrong_type" })
  })
})
