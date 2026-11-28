import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { prisma } from "@/lib/prisma"
import { brandingForBottle, brandingForCap } from "@/lib/brand-server"
import { TEST_DB, makeBottle, makeManufacturer, resetDatabase } from "./setup"

describe.skipIf(!TEST_DB)("brand page lookups (database)", () => {
  beforeEach(async () => {
    await resetDatabase()
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("shows the plain page until the brand switches its page on", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "SINGLE", serialId: "BRAND1" })
    await prisma.brandProfile.create({ data: { manufacturerId: manufacturer.id, enabled: false } })

    expect((await brandingForBottle("BRAND1")).brand).toBeNull()

    await prisma.brandProfile.update({
      where: { manufacturerId: manufacturer.id },
      data: { enabled: true, displayName: "Zobo Gold", websiteUrl: "https://zobo.ng/" },
    })
    const { brand, product } = await brandingForBottle("BRAND1")
    expect(brand?.name).toBe("Zobo Gold")
    expect(brand?.links[0]?.href).toBe("https://zobo.ng/")
    expect(product?.name).toBe("P BRAND1")
  })

  it("never records a scan or changes a code's status", async () => {
    const { manufacturer } = await makeManufacturer()
    const { bottle } = await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "BRAND2", withCap: "CAPBRAND2XXXXXXX" })
    await prisma.brandProfile.create({ data: { manufacturerId: manufacturer.id, enabled: true } })

    await brandingForBottle("BRAND2")
    await brandingForCap("CAPBRAND2XXXXXXX")

    expect(await prisma.scanLog.count()).toBe(0)
    const fresh = await prisma.bottle.findUnique({ where: { id: bottle.id }, include: { cap: true } })
    expect(fresh?.status).toBe("MINT")
    expect(fresh?.cap?.status).toBe("SEALED")
  })

  it("drops the branding for a suspended brand", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "SINGLE", serialId: "BRAND3" })
    await prisma.brandProfile.create({ data: { manufacturerId: manufacturer.id, enabled: true } })
    await prisma.manufacturer.update({ where: { id: manufacturer.id }, data: { onboardingStatus: "SUSPENDED" } })

    expect((await brandingForBottle("BRAND3")).brand).toBeNull()
  })

  it("finds the brand of a cap through its bottle", async () => {
    const { manufacturer } = await makeManufacturer()
    await makeBottle(manufacturer.id, { authMode: "PAIRED", serialId: "BRAND4", withCap: "CAPBRAND4XXXXXXX" })
    await prisma.brandProfile.create({ data: { manufacturerId: manufacturer.id, enabled: true } })

    expect((await brandingForCap("CAPBRAND4XXXXXXX")).brand?.name).toBe(manufacturer.companyName)
    expect((await brandingForCap("NOPENOPENOPENOPE")).brand).toBeNull()
  })
})
