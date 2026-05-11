"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"

interface NavLinkProps {
  href: string
  children: React.ReactNode
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-medium"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
      }`}
    >
      {children}
    </Link>
  )
}