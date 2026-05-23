import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = "coderedhrs@gmail.com" // replace with your actual email

  const user = await prisma.user.update({
    where: { email },
    data: { role: "SUPER_ADMIN" },
  })

  console.log(`✓ Promoted ${user.email} to SUPER_ADMIN`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())