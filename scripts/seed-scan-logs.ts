import { prisma } from "@/lib/prisma"

async function seedScanLogs() {
  await prisma.scanLog.createMany({
    data: [
      {
        manufacturerId: "cmpifj7750001l20448id8hv2",
        scanLayer: "BOTTLE",
        fraudFlag: true,
        lat: 6.5244,
        lng: 3.3792,
        region: "Lagos",
        scannedAt: new Date(),
      },
      {
        manufacturerId: "cmpifj7750001l20448id8hv2",
        scanLayer: "BOTTLE",
        fraudFlag: false,
        lat: 9.0765,
        lng: 7.3986,
        region: "Abuja",
        scannedAt: new Date(),
      },
      {
        manufacturerId: "cmpifj7750001l20448id8hv2",
        scanLayer: "BOTTLE",
        fraudFlag: true,
        lat: 4.8156,
        lng: 7.0498,
        region: "Port Harcourt",
        scannedAt: new Date(),
      },
    ],
  })

  console.log("Scan logs seeded")
}

seedScanLogs()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })