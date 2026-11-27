import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const existing = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { teamManufacturerId: true, role: true },
  })

  // A team member of another company cannot register a company of their own
  // with the same account, and neither can a team member who was removed
  // (their role is still factory operator or distributor manager).
  if (member && member.role !== "MANUFACTURER_ADMIN") {
    return Response.json({ error: "This account cannot register a company" }, { status: 403 })
  }
  if (existing || member?.teamManufacturerId) {
    return Response.json(
      { error: "Manufacturer already exists" },
      { status: 400 }
    )
  }

  const body = await req.json()

  const {
    companyName,
    rcNumber,
    taxId,
    industryType,
    factoryLocations,
    productionCapacity,
    brandPortfolio,
    primaryContact,
    phone,
    technicalContact,
    complianceOfficer,
    estimatedBottlesPerMonth,
    packagingType,
    capSupplier,
    bottlingLineType,
    erpSystem,
    nafdacNumbers,
    distributionRegions,
  } = body

  if (!companyName?.trim()) {
    return Response.json(
      { error: "Company name is required" },
      { status: 400 }
    )
  }

  if (!primaryContact?.trim() || !phone?.trim()) {
    return Response.json(
      { error: "Primary contact and phone are required" },
      { status: 400 }
    )
  }

  if (!nafdacNumbers?.trim()) {
    return Response.json(
      { error: "NAFDAC registration numbers are required" },
      { status: 400 }
    )
  }

  await prisma.manufacturer.create({
    data: {
      userId: session.user.id,
      companyName: companyName.trim(),
      rcNumber: rcNumber?.trim() || null,
      taxId: taxId?.trim() || null,
      industryType: industryType || null,
      factoryLocations: factoryLocations?.trim() || null,
      productionCapacity: productionCapacity
        ? parseInt(productionCapacity, 10)
        : null,
      brandPortfolio: brandPortfolio?.trim() || null,
      primaryContact: primaryContact.trim(),
      phone: phone.trim(),
      technicalContact: technicalContact?.trim() || null,
      complianceOfficer: complianceOfficer?.trim() || null,
      estimatedBottlesPerMonth: estimatedBottlesPerMonth
        ? parseInt(estimatedBottlesPerMonth, 10)
        : null,
      packagingType: packagingType || null,
      capSupplier: capSupplier?.trim() || null,
      bottlingLineType: bottlingLineType || null,
      erpSystem: erpSystem?.trim() || null,
      nafdacNumbers: nafdacNumbers.trim(),
      distributionRegions: distributionRegions?.trim() || null,
      onboardingStatus: "PENDING_REVIEW",
    },
  })

  return Response.json({ success: true })
}