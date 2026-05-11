"use client"

import { useState } from "react"
import { NavLink } from "@/components/nav-link"
import { ThemeToggle } from "@/components/theme-toggle"

interface SidebarProps {
  email: string
  companyName?: string
  signOutAction: () => Promise<void>
}

export function Sidebar({ email, signOutAction }: SidebarProps) {
  const [open, setOpen] = useState(false)

  const navItems = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/batches", label: "Batches" },
    { href: "/dashboard/scans", label: "Scan Logs" },
    { href: "/dashboard/fraud", label: "Fraud Alerts" },
    { href: "/dashboard/products", label: "Products" },
  ]

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
            <span className="text-white dark:text-gray-900 text-xs font-bold">V</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white text-sm">VerifyChain</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOpen(!open)}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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

      {/* Mobile nav overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile nav drawer */}
      <div className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 transform transition-transform duration-200 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <p className="font-bold text-gray-900 dark:text-white">VerifyChain</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{email}</p>
        </div>
        <nav className="p-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <div key={item.href} onClick={() => setOpen(false)}>
              <NavLink href={item.href}>{item.label}</NavLink>
            </div>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800">
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

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
              <span className="text-white dark:text-gray-900 text-xs font-bold">V</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-white">VerifyChain</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</p>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3">
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