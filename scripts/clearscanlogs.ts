import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.scanLog.deleteMany()
  console.log("ScanLog cleared")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())