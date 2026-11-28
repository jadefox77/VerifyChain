import type { Metadata } from "next"
import { CapVerify } from "@/components/verify/cap-verify"
import { VerifyShell } from "@/components/verify/verify-shell"
import { brandingForCap } from "@/lib/brand-server"
import { verifySignature } from "@/lib/serial"

// The cap is only marked as opened when the consumer taps the button.
// Loading the brand is a read-only lookup and records nothing.
export const metadata: Metadata = {
  title: "Confirm the cap",
  robots: { index: false, follow: false },
}

export default async function CapVerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ hiddenSerialId: string }>
  searchParams: Promise<{ sig?: string; bottle?: string }>
}) {
  const { hiddenSerialId } = await params
  const { sig, bottle } = await searchParams

  const signed = hiddenSerialId.length <= 24 && typeof sig === "string" && verifySignature(hiddenSerialId, sig)
  const { brand, product } = signed ? await brandingForCap(hiddenSerialId) : { brand: null, product: null }

  return (
    <VerifyShell brand={brand}>
      <CapVerify hiddenSerialId={hiddenSerialId} sig={sig} bottle={bottle} product={product} />
    </VerifyShell>
  )
}
