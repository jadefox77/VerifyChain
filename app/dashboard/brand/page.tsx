import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/workspace"
import { DEFAULT_BRAND, brandImageUrl } from "@/lib/brand"
import { PageHeader } from "@/components/ui/page-header"
import { Notice } from "@/components/ui/auth-shell"
import { BrandForm, type BrandFormValues } from "@/components/dashboard/brand-form"
import { ProductDisplayList } from "@/components/dashboard/product-display"

export const metadata: Metadata = { title: "Brand page" }

const ERRORS: Record<string, string> = {
  bad_color: "Colours must be hex values such as #078f5a.",
  bad_link: "Links must be full https addresses, such as https://yourbrand.com.",
  bad_email: "That support email address does not look right.",
  bad_phone: "Phone numbers can use digits, spaces, brackets, dashes and a leading +.",
  image_too_big: "Images must be 300 KB or smaller.",
  image_type: "Images must be PNG, JPEG or WebP files.",
  not_found: "That product was not found.",
}

export default async function BrandPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const { manufacturer } = await requireWorkspace("manageBrand")
  const params = await searchParams

  const [profile, products] = await Promise.all([
    prisma.brandProfile.findUnique({ where: { manufacturerId: manufacturer.id } }),
    prisma.product.findMany({
      where: { manufacturerId: manufacturer.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, category: true, description: true, imageId: true },
    }),
  ])

  const values: BrandFormValues = {
    enabled: profile?.enabled ?? false,
    displayName: profile?.displayName ?? "",
    tagline: profile?.tagline ?? "",
    primaryColor: profile?.primaryColor ?? DEFAULT_BRAND.primaryColor,
    secondaryColor: profile?.secondaryColor ?? DEFAULT_BRAND.secondaryColor,
    backgroundColor: profile?.backgroundColor ?? DEFAULT_BRAND.backgroundColor,
    fontStyle: (profile?.fontStyle as BrandFormValues["fontStyle"]) ?? DEFAULT_BRAND.fontStyle,
    websiteUrl: profile?.websiteUrl ?? "",
    supportUrl: profile?.supportUrl ?? "",
    instagramUrl: profile?.instagramUrl ?? "",
    facebookUrl: profile?.facebookUrl ?? "",
    xUrl: profile?.xUrl ?? "",
    tiktokUrl: profile?.tiktokUrl ?? "",
    supportEmail: profile?.supportEmail ?? "",
    supportPhone: profile?.supportPhone ?? "",
    logoUrl: brandImageUrl(profile?.logoImageId),
  }

  const sample = products.find((p) => p.imageId) ?? products[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand page"
        description="Shoppers who scan your products see your logo, colours and links around the check. The result itself always comes from VerifyChain and keeps its fixed colours, and a small VerifyChain mark stays at the bottom."
      />

      {params.saved === "brand" && (
        <Notice tone="success">
          {values.enabled
            ? "Saved. Shoppers now see your brand page when they scan your products."
            : "Saved. Your brand page is switched off, so shoppers still see the standard VerifyChain page."}
        </Notice>
      )}
      {params.saved === "product" && <Notice tone="success">Product display saved.</Notice>}
      {params.error && <Notice tone="error">{ERRORS[params.error] ?? "That did not work. Please try again."}</Notice>}

      <BrandForm
        initial={values}
        companyName={manufacturer.companyName}
        sampleProduct={
          sample
            ? {
                name: sample.name,
                category: sample.category,
                description: sample.description,
                imageUrl: brandImageUrl(sample.imageId),
              }
            : null
        }
      />

      <ProductDisplayList
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description ?? "",
          imageUrl: brandImageUrl(p.imageId),
        }))}
      />
    </div>
  )
}
