"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScanLine,
  ShieldAlert,
  X,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/ui/logo"

interface SidebarProps {
  email: string
  companyName: string
  signOutAction: () => Promise<void>
}

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/batches", label: "Batches", icon: Boxes },
  { href: "/dashboard/scans", label: "Scan activity", icon: ScanLine },
  { href: "/dashboard/fraud", label: "Fraud alerts", icon: ShieldAlert },
  { href: "/dashboard/billing", label: "Plan and usage", icon: CreditCard },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <ul className="space-y-0.5">
      {navItems.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function AccountFooter({ email, companyName, signOutAction }: SidebarProps) {
  return (
    <div className="space-y-3 border-t border-gray-200 p-3 dark:border-gray-800">
      <div className="px-2">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{companyName}</p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
      </div>
      <div className="flex items-center justify-between gap-2 px-1">
        <ThemeToggle />
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}

export function Sidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden dark:border-gray-800 dark:bg-gray-900">
        <Link href="/dashboard" aria-label="Dashboard home">
          <Logo compact />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </header>

      {open && <div className="fixed inset-0 z-30 bg-gray-950/40 lg:hidden" onClick={close} aria-hidden="true" />}

      <div
        id="mobile-nav"
        className={`fixed bottom-0 left-0 top-14 z-40 flex w-72 max-w-[85vw] flex-col border-r border-gray-200 bg-white transition-transform duration-200 lg:hidden dark:border-gray-800 dark:bg-gray-900 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        inert={!open}
      >
        <nav aria-label="Dashboard" className="flex-1 overflow-y-auto p-3">
          <NavList onNavigate={close} />
        </nav>
        <AccountFooter {...props} />
      </div>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex dark:border-gray-800 dark:bg-gray-900">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" aria-label="Dashboard home">
            <Logo compact label="Manufacturer" />
          </Link>
        </div>
        <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-2">
          <NavList />
        </nav>
        <AccountFooter {...props} />
      </aside>
    </>
  )
}
