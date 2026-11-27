"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  CreditCard,
  GitPullRequestArrow,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  ShieldAlert,
  Users,
  X,
} from "lucide-react"
import type { UserRole } from "@prisma/client"
import { cn } from "@/lib/utils"
import { handleSignOut } from "@/lib/actions/auth"
import { Logo } from "@/components/ui/logo"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: UserRole[]
  group: "operations" | "monitoring" | "platform"
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"], group: "operations" },
  { label: "Manufacturers", href: "/admin/manufacturers", icon: Building2, roles: ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"], group: "operations" },
  { label: "Onboarding", href: "/admin/onboarding", icon: GitPullRequestArrow, roles: ["SUPER_ADMIN", "SUPPORT"], group: "operations" },
  { label: "Fraud", href: "/admin/fraud", icon: ShieldAlert, roles: ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"], group: "monitoring" },
  { label: "Alerts", href: "/admin/alerts", icon: Bell, roles: ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"], group: "monitoring" },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3, roles: ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT", "REGULATORY_OBSERVER"], group: "monitoring" },
  { label: "Serialisation", href: "/admin/serialization", icon: Cpu, roles: ["SUPER_ADMIN", "SUPPORT"], group: "platform" },
  { label: "Regulatory", href: "/admin/regulatory", icon: ScrollText, roles: ["SUPER_ADMIN", "REGULATORY_OBSERVER"], group: "platform" },
  { label: "Users", href: "/admin/users", icon: Users, roles: ["SUPER_ADMIN"], group: "platform" },
  { label: "Billing", href: "/admin/billing", icon: CreditCard, roles: ["SUPER_ADMIN"], group: "platform" },
]

const GROUP_LABELS = {
  operations: "Operations",
  monitoring: "Monitoring",
  platform: "Platform",
}

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  FRAUD_ANALYST: "Fraud analyst",
  REGULATORY_OBSERVER: "Regulatory observer",
  SUPPORT: "Support",
}

interface AdminSidebarProps {
  userRole: UserRole
  userName: string
  alertCount?: number
}

function SidebarContents({
  userRole,
  userName,
  alertCount = 0,
  onNavigate,
  collapsed = false,
}: AdminSidebarProps & { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname()
  const visible = NAV_ITEMS.filter((item) => item.roles.includes(userRole))
  const groups = (["operations", "monitoring", "platform"] as const)
    .map((g) => ({ key: g, label: GROUP_LABELS[g], items: visible.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0)

  return (
    <>
      <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.key}>
            {collapsed ? (
              <div className="mx-2 mb-2 h-px bg-gray-800" aria-hidden="true" />
            ) : (
              <p className="mb-1.5 px-2 text-xs font-medium text-gray-500">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(item.href + "/")
                const Icon = item.icon
                const showBadge = item.href === "/admin/alerts" && alertCount > 0
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        collapsed && "justify-center",
                        isActive
                          ? "bg-white/10 font-medium text-white"
                          : "text-gray-400 hover:bg-white/5 hover:text-gray-100"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-brand-400")} aria-hidden="true" />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {showBadge && collapsed && (
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                      )}
                      {showBadge && !collapsed && (
                        <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30">
                          {alertCount > 99 ? "99+" : alertCount}
                          <span className="sr-only"> high-priority alerts</span>
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-800 p-3">
        {!collapsed && (
          <div className="px-2">
            <p className="truncate text-sm font-medium text-gray-100">{userName}</p>
            <p className="text-xs text-gray-500">{ROLE_NAMES[userRole] ?? userRole}</p>
          </div>
        )}
        <form action={handleSignOut} className={collapsed ? "" : "mt-2"}>
          <button
            type="submit"
            title={collapsed ? "Sign out" : undefined}
            aria-label={collapsed ? "Sign out" : undefined}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-100",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {!collapsed && "Sign out"}
          </button>
        </form>
      </div>
    </>
  )
}

export function AdminSidebar(props: AdminSidebarProps) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-gray-800 bg-gray-950 px-4 lg:hidden">
        <Link href="/admin" aria-label="Admin home">
          <Logo compact label="Admin" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-lg p-2 text-gray-300 hover:bg-white/10"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </header>

      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div
        id="admin-mobile-nav"
        inert={!open}
        className={cn(
          "fixed bottom-0 left-0 top-14 z-40 flex w-72 max-w-[85vw] flex-col border-r border-gray-800 bg-gray-950 transition-transform duration-200 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContents {...props} onNavigate={() => setOpen(false)} />
      </div>

      {/* Desktop */}
      <aside
        className={cn(
          "hidden h-[100dvh] shrink-0 flex-col border-r border-gray-800 bg-gray-950 transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-gray-800", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          {!collapsed && (
            <Link href="/admin" aria-label="Admin home">
              <Logo compact label="Admin" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1.5 text-gray-500 hover:bg-white/10 hover:text-gray-200"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        <SidebarContents {...props} collapsed={collapsed} />
      </aside>
    </>
  )
}
