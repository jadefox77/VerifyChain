"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

interface SidebarProps {
  email: string
  signOutAction: () => Promise<void>
}

const navItems = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/batches", label: "Batches", exact: false },
  { href: "/dashboard/scans", label: "Scan Logs", exact: false },
  { href: "/dashboard/fraud", label: "Fraud Alerts", exact: false },
  { href: "/dashboard/products", label: "Products", exact: false },
  { href: "/dashboard/billing", label: "Billing", exact: false },
]

function NavItem({
  href,
  label,
  exact,
  onClick,
}: {
  href: string
  label: string
  exact: boolean
  onClick?: () => void
}) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
      }`}
    >
      {label}
    </Link>
  )
}

export function Sidebar({ email, signOutAction }: SidebarProps) {
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
            <span className="text-white dark:text-gray-900 text-xs font-bold">V</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white text-sm">
            VerifyChain
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOpen(!open)}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle menu"
          >
            {open ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Mobile backdrop ── */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={close}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className={`lg:hidden fixed top-14 left-0 bottom-0 w-64 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transform transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</p>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.href} {...item} onClick={close} />
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
              <span className="text-white dark:text-gray-900 text-xs font-bold">V</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-white">VerifyChain</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">{email}</p>
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3">
          <ThemeToggle />
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}