"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Building2,
  GitPullRequestArrow,
  ShieldAlert,
  Cpu,
  Bell,
  BarChart3,
  ScrollText,
  Users,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
  CreditCard,
  LogOut,
} from "lucide-react"
import type { UserRole } from "@prisma/client"
import { cn } from "@/lib/utils"
import { handleSignOut } from "@/lib/actions/auth"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: UserRole[]
  group: "operations" | "intelligence" | "platform"
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Command Center",
    href: "/admin",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"],
    group: "operations",
  },
  {
    label: "Manufacturers",
    href: "/admin/manufacturers",
    icon: Building2,
    roles: ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"],
    group: "operations",
  },
  {
    label: "Onboarding",
    href: "/admin/onboarding",
    icon: GitPullRequestArrow,
    roles: ["SUPER_ADMIN", "SUPPORT"],
    group: "operations",
  },
  {
    label: "Fraud Intelligence",
    href: "/admin/fraud",
    icon: ShieldAlert,
    roles: ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"],
    group: "intelligence",
  },
  {
    label: "Live Alerts",
    href: "/admin/alerts",
    icon: Bell,
    roles: ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"],
    group: "intelligence",
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT", "REGULATORY_OBSERVER"],
    group: "intelligence",
  },
  {
    label: "Serialization",
    href: "/admin/serialization",
    icon: Cpu,
    roles: ["SUPER_ADMIN", "SUPPORT"],
    group: "platform",
  },
  {
    label: "Regulatory",
    href: "/admin/regulatory",
    icon: ScrollText,
    roles: ["SUPER_ADMIN", "REGULATORY_OBSERVER"],
    group: "platform",
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: Users,
    roles: ["SUPER_ADMIN"],
    group: "platform",
  },
  {
    label: "Billing",
    href: "/admin/billing",
    icon: CreditCard,
    roles: ["SUPER_ADMIN"],
    group: "platform",
  },
]

const GROUP_LABELS = {
  operations: "Operations",
  intelligence: "Intelligence",
  platform: "Platform",
}

interface AdminSidebarProps {
  userRole: UserRole
  alertCount?: number
}

export function AdminSidebar({
  userRole,
  alertCount = 0,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  )

  const groups = (
    ["operations", "intelligence", "platform"] as const
  )
    .map((group) => ({
      key: group,
      label: GROUP_LABELS[group],
      items: visibleItems.filter((i) => i.group === group),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-gray-950 border-r border-gray-800/60 transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800/60">
        {!collapsed && (
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-bold text-white tracking-wider">
                VERIFYCHAIN
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5 pl-7">
              ADMIN PORTAL
            </p>
          </div>
        )}
        {collapsed && (
          <Shield className="w-5 h-5 text-blue-400 mx-auto" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Live status indicator */}
      {!collapsed && (
        <div className="px-4 py-2 border-b border-gray-800/60">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[10px] font-mono text-gray-500">
              SYSTEMS OPERATIONAL
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {groups.map((group) => (
          <div key={group.key}>
            {!collapsed && (
              <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest px-2 mb-2">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href)
                const Icon = item.icon
                const showBadge =
                  item.href === "/admin/alerts" && alertCount > 0

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all group relative",
                        isActive
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Icon className="w-4 h-4" />
                        {showBadge && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </div>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">
                            {item.label}
                          </span>
                          {showBadge && (
                            <span className="text-[10px] font-mono bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                              {alertCount > 99 ? "99+" : alertCount}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-400 rounded-r" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-800/60 space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-gray-600" />
            <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
              {userRole.replace(/_/g, " ")}
            </span>
          </div>
          <form action={handleSignOut}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-[10px] font-mono text-gray-600 hover:text-gray-400 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Sign out
            </button>
          </form>
        </div>
      )}

      {collapsed && (
        <div className="px-2 py-3 border-t border-gray-800/60 flex justify-center">
          <form action={handleSignOut}>
            <button
              type="submit"
              className="text-gray-600 hover:text-gray-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </aside>
  )
}