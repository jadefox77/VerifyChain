import type { Metadata } from "next"
import { BottleVerify } from "@/components/verify/bottle-verify"
import { VerifyShell } from "@/components/verify/verify-shell"
import { brandingForBottle } from "@/lib/brand-server"
import { verifySignature } from "@/lib/serial"

// Verification happens only when the consumer taps the button, so link
// previews, crawlers and prefetching can never mark a product as scanned.
// Loading the brand is a read-only lookup and records nothing.
export const metadata: Metadata = {
  title: "Check a product",
  robots: { index: false, follow: false },
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ serialId: string }>
  searchParams: Promise<{ sig?: string }>
}) {
  const { serialId } = await params
  const { sig } = await searchParams

  // Only a correctly signed code reveals whose product it is.
  const signed = serialId.length <= 20 && typeof sig === "string" && verifySignature(serialId, sig)
  const { brand, product } = signed ? await brandingForBottle(serialId) : { brand: null, product: null }

  return (
    <VerifyShell brand={brand}>
      <BottleVerify serialId={serialId} sig={sig} product={product} />
    </VerifyShell>
  )
}
