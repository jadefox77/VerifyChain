import Link from "next/link"
import type { ReactNode } from "react"
import { LogoMark } from "@/components/ui/logo"
import { BrandShell } from "@/components/verify/brand-shell"
import type { BrandView } from "@/lib/brand"

// Mobile-first frame for the consumer verification screens. When the
// product's brand has a published brand page, its own frame is used instead.
export function VerifyShell({ children, brand }: { children: ReactNode; brand?: BrandView | null }) {
  if (brand) return <BrandShell brand={brand}>{children}</BrandShell>

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center justify-center gap-2 px-4 pb-2 pt-6">
        <LogoMark className="h-7 w-7" />
        <span className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
          VerifyChain Africa
        </span>
      </header>
      <main id="main" className="flex flex-1 flex-col items-center px-4 py-6 sm:justify-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-gray-500 dark:text-gray-400">
        Product checks by VerifyChain Africa.{" "}
        <Link href="/#how-it-works" className="underline underline-offset-2">
          How it works
        </Link>
      </footer>
    </div>
  )
}
