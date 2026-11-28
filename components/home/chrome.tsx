import type { ReactNode } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { buttonPrimary } from "@/lib/ui"
import { cn } from "@/lib/utils"

export const SUPPORT_EMAIL = "support@verifychain.africa"

// One label per intent across the whole page.
export const CTA_REGISTER = "Register your company"

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#manufacturers", label: "Features" },
  { href: "#fraud", label: "Fraud checks" },
  { href: "#brands", label: "Brand pages" },
  { href: "/developers", label: "Developers" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/85 backdrop-blur-md dark:border-gray-800/70 dark:bg-gray-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="VerifyChain Africa home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-gray-600 lg:flex dark:text-gray-400">
          {NAV.map((n) =>
            n.href.startsWith("/") ? (
              <Link key={n.href} href={n.href} className="transition-colors hover:text-gray-900 dark:hover:text-white">
                {n.label}
              </Link>
            ) : (
              <a key={n.href} href={n.href} className="transition-colors hover:text-gray-900 dark:hover:text-white">
                {n.label}
              </a>
            )
          )}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className="max-sm:hidden" />
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Sign in
          </Link>
          <Link href="/login" className={`${buttonPrimary} px-3.5 py-2 max-md:hidden`}>
            {CTA_REGISTER}
          </Link>
          {/* Small screens: a native disclosure, so the menu works without JavaScript */}
          <details className="group relative lg:hidden">
            <summary
              aria-label="Open menu"
              className="flex h-9 w-9 list-none items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 [&::-webkit-details-marker]:hidden"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 top-11 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg shadow-gray-900/5 dark:border-gray-800 dark:bg-gray-900"
            >
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {n.label}
                </a>
              ))}
              <Link href="/login" className={`${buttonPrimary} mt-2 w-full md:hidden`}>
                {CTA_REGISTER}
              </Link>
              <div className="mt-2 flex justify-center border-t border-gray-100 pt-2 sm:hidden dark:border-gray-800">
                <ThemeToggle />
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id?: string
  eyebrow?: string
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-400">{eyebrow}</p>
      )}
      <h2
        id={id}
        className={cn(
          "text-3xl font-semibold leading-[1.15] tracking-tight text-gray-900 sm:text-4xl dark:text-white",
          eyebrow && "mt-3"
        )}
      >
        {title}
      </h2>
      {children && (
        <div className="mt-4 max-w-[65ch] text-base leading-relaxed text-gray-600 dark:text-gray-400">{children}</div>
      )}
    </div>
  )
}

export function SiteFooter() {
  const groups = [
    {
      title: "Product",
      links: [
        { href: "#how-it-works", label: "How a check works" },
        { href: "#manufacturers", label: "Manufacturer tools" },
        { href: "#fraud", label: "Fraud checks" },
        { href: "#brands", label: "Brand pages" },
      ],
    },
    {
      title: "Build",
      links: [
        { href: "/developers", label: "Verification API docs" },
        { href: "#api", label: "API overview" },
      ],
    },
    {
      title: "Company",
      links: [
        { href: "/login", label: "Sign in" },
        { href: `mailto:${SUPPORT_EMAIL}`, label: SUPPORT_EMAIL },
      ],
    },
  ]

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.3fr_2fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            Product authentication for bottled and packaged goods made and sold in Nigeria.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{g.title}</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="break-words hover:text-gray-900 dark:hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-100 dark:border-gray-900">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-gray-400 sm:px-6 dark:text-gray-500">
          &copy; {new Date().getFullYear()} VerifyChain Africa
        </p>
      </div>
    </footer>
  )
}
