import { prisma } from "@/lib/prisma"

// Database tests need a throwaway Postgres with the migrations applied:
//   TEST_DATABASE_URL=postgresql://... npx prisma migrate deploy   (with DATABASE_URL and DIRECT_URL set to it)
//   TEST_DATABASE_URL=postgresql://... npm test
// They delete every row, so they refuse to run against anything but a local
// database.
export const TEST_DB = process.env.TEST_DATABASE_URL ?? ""

export function assertLocalDatabase() {
  const host = new URL(TEST_DB).hostname
  if (!["localhost", "127.0.0.1", "postgres"].includes(host)) {
    throw new Error(`Refusing to run database tests against ${host}. Use a local throwaway database.`)
  }
}

export async function resetDatabase() {
  assertLocalDatabase()
  await prisma.$executeRawUnsafe(
    `TRUNCATE "ApiUsageDay", "ApiKey", "BrandProfile", "BrandImage", "AlertLog", "ScanLog", "Cap", "Bottle", "Batch", "Product", "AuditLog", "AdminNote", "Manufacturer", "Account", "Session", "User" RESTART IDENTITY CASCADE`
  )
}

let counter = 0
export async function makeManufacturer() {
  counter++
  const user = await prisma.user.create({ data: { email: `owner${counter}@test.local` } })
  const manufacturer = await prisma.manufacturer.create({
    data: { userId: user.id, companyName: `Test Co ${counter}`, onboardingStatus: "ACTIVE_PRODUCTION" },
  })
  return { user, manufacturer }
}

export async function makeBottle(
  manufacturerId: string,
  opts: { authMode: "PAIRED" | "SINGLE"; targetRegion?: string; serialId: string; withCap?: string }
) {
  const product = await prisma.product.create({
    data: { manufacturerId, name: `P ${opts.serialId}`, category: "Test", authMode: opts.authMode },
  })
  const batch = await prisma.batch.create({
    data: {
      manufacturerId,
      productId: product.id,
      bottleCount: 1,
      batchCode: `B-${opts.serialId}`,
      targetRegion: opts.targetRegion ?? null,
    },
  })
  const bottle = await prisma.bottle.create({
    data: { serialId: opts.serialId, batchId: batch.id, manufacturerId, hmacSig: "test" },
  })
  if (opts.withCap) {
    await prisma.cap.create({
      data: { bottleId: bottle.id, topCode: opts.serialId.slice(-6).padStart(6, "T"), hiddenSerialId: opts.withCap, hiddenHmacSig: "test" },
    })
  }
  return { product, batch, bottle }
}
