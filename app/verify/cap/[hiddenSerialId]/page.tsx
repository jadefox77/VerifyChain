import type { Metadata } from "next"
import { CapVerify } from "@/components/verify/cap-verify"

// The cap is only marked as opened when the consumer taps the button.
export const metadata: Metadata = {
  title: "Confirm cap — VerifyChain Africa",
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

  return <CapVerify hiddenSerialId={hiddenSerialId} sig={sig} bottle={bottle} />
}
