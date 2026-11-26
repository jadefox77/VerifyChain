import type { Metadata } from "next"
import { Shield } from "lucide-react"
import { BottleVerify } from "@/components/verify/bottle-verify"

// Verification happens only when the consumer taps the button, so link
// previews, crawlers and prefetching can never mark a product as scanned.
export const metadata: Metadata = {
  title: "Verify product — VerifyChain Africa",
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
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm mb-8 flex items-center justify-center gap-2">
        <Shield className="w-5 h-5 text-blue-400" />
        <span className="text-sm font-bold text-white tracking-wider">
          VERIFYCHAIN AFRICA
        </span>
      </div>
      <BottleVerify serialId={serialId} sig={sig} />
    </main>
  )
}
