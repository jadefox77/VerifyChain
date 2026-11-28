import { prisma } from "@/lib/prisma"
import { brandImageUrl, toBrandView, type BrandView, type ProductView } from "@/lib/brand"

// Read-only lookups for the scan pages. They never write a scan log or change
// a code's status, so link previews and prefetching cannot mark anything as
// scanned. Callers must check the QR signature first.

export type ScanBranding = { brand: BrandView | null; product: ProductView | null }

const NONE: ScanBranding = { brand: null, product: null }

const productSelect = {
  name: true,
  category: true,
  description: true,
  imageId: true,
} as const

const manufacturerSelect = {
  companyName: true,
  onboardingStatus: true,
  brandProfile: {
    select: {
      enabled: true,
      displayName: true,
      tagline: true,
      logoImageId: true,
      primaryColor: true,
      secondaryColor: true,
      backgroundColor: true,
      fontStyle: true,
      websiteUrl: true,
      supportUrl: true,
      supportEmail: true,
      supportPhone: true,
      instagramUrl: true,
      facebookUrl: true,
      xUrl: true,
      tiktokUrl: true,
    },
  },
} as const

type ManufacturerRow = {
  companyName: string
  onboardingStatus: string
  brandProfile: (Parameters<typeof toBrandView>[0] & { enabled: boolean }) | null
}

type ProductRow = { name: string; category: string | null; description: string | null; imageId: string | null }

function build(m: ManufacturerRow | null | undefined, p: ProductRow | null | undefined): ScanBranding {
  // A suspended or not yet approved brand gets the plain VerifyChain page.
  if (!m || m.onboardingStatus !== "ACTIVE_PRODUCTION" || !m.brandProfile?.enabled) return NONE
  return {
    brand: toBrandView(m.brandProfile, m.companyName),
    product: p
      ? { name: p.name, category: p.category, description: p.description, imageUrl: brandImageUrl(p.imageId) }
      : null,
  }
}

export async function brandingForBottle(serialId: string): Promise<ScanBranding> {
  try {
    const bottle = await prisma.bottle.findUnique({
      where: { serialId },
      select: {
        manufacturer: { select: manufacturerSelect },
        batch: { select: { product: { select: productSelect } } },
      },
    })
    return build(bottle?.manufacturer, bottle?.batch.product)
  } catch (error) {
    // Branding is decoration. If it fails, the plain page still works.
    console.error("Brand lookup failed:", error)
    return NONE
  }
}

export async function brandingForCap(hiddenSerialId: string): Promise<ScanBranding> {
  try {
    const cap = await prisma.cap.findUnique({
      where: { hiddenSerialId },
      select: {
        batchId: true,
        bottle: {
          select: {
            manufacturer: { select: manufacturerSelect },
            batch: { select: { product: { select: productSelect } } },
          },
        },
      },
    })
    if (cap?.bottle) return build(cap.bottle.manufacturer, cap.bottle.batch.product)
    if (cap?.batchId) {
      // An unpaired cap still knows which batch it came from
      const batch = await prisma.batch.findUnique({
        where: { id: cap.batchId },
        select: { manufacturer: { select: manufacturerSelect }, product: { select: productSelect } },
      })
      return build(batch?.manufacturer, batch?.product)
    }
    return NONE
  } catch (error) {
    console.error("Brand lookup failed:", error)
    return NONE
  }
}
