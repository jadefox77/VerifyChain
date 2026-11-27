import Link from "next/link"
import type { ReactNode } from "react"
import { Logo } from "@/components/ui/logo"

// Centered layout shared by sign-in, password, onboarding status and error pages.
export function AuthShell({
  children,
  width = "sm",
  footer,
}: {
  children: ReactNode
  width?: "sm" | "md" | "lg"
  footer?: ReactNode
}) {
  const max = width === "lg" ? "max-w-2xl" : width === "md" ? "max-w-md" : "max-w-sm"
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <header className="px-4 py-5 sm:px-6">
        <Link href="/" aria-label="VerifyChain Africa home" className="inline-flex">
          <Logo />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className={`w-full ${max}`}>{children}</div>
      </main>
      {footer && (
        <footer className="px-4 pb-6 text-center text-xs text-gray-500 dark:text-gray-400">
          {footer}
        </footer>
      )}
    </div>
  )
}

export function AuthCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-6 shadow-xs sm:p-8 dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {children}
    </div>
  )
}

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "info" | "success" | "warn"
  children: ReactNode
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
    success: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  }[tone]
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3.5 py-3 text-sm ${styles}`}>
      {children}
    </div>
  )
}
