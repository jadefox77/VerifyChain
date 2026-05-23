
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.manufacturer.upsert({
    where: {
      userId: "cmpiezq200000ji04xt6ietp9",
    },
    update: {
      companyName: "Lagos Beverages Ltd",
      rcNumber: "RC-1234567",
      industryType: "Beverage",
      onboardingStatus: "PENDING_REVIEW",
      subscriptionPlan: "STARTER",
    },
    create: {
      userId: "cmpiezq200000ji04xt6ietp9",
      companyName: "Lagos Beverages Ltd",
      rcNumber: "RC-1234567",
      industryType: "Beverage",
      onboardingStatus: "PENDING_REVIEW",
      subscriptionPlan: "STARTER",
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })