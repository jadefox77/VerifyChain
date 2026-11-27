import type { Metadata } from "next"
import { BottleVerify } from "@/components/verify/bottle-verify"
import { VerifyShell } from "@/components/verify/verify-shell"

// Verification happens only when the consumer taps the button, so link
// previews, crawlers and prefetching can never mark a product as scanned.
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

  return (
    <VerifyShell>
      <BottleVerify serialId={serialId} sig={sig} />
    </VerifyShell>
  )
}
