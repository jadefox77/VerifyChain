import { requireSuperAdmin, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_BADGE_COLORS } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { Users, Shield, Mail, Calendar, ChevronDown } from "lucide-react"
import type { UserRole } from "@prisma/client"

export const revalidate = 30

async function getUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      createdAt: true,
      manufacturer: {
        select: {
          id: true,
          companyName: true,
          onboardingStatus: true,
        },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { action: true, createdAt: true },
      },
    },
  })
}

async function getRoleCounts() {
  return prisma.user.groupBy({
    by: ["role"],
    _count: true,
  })
}

const ALL_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "MANUFACTURER_ADMIN",
  "FACTORY_OPERATOR",
  "FRAUD_ANALYST",
  "REGULATORY_OBSERVER",
  "DISTRIBUTOR_MANAGER",
  "SUPPORT",
]

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default async function UsersPage() {
  await requireSuperAdmin()

  const [users, roleCounts] = await Promise.all([
    getUsers(),
    getRoleCounts(),
  ])

  const totalUsers = users.length

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            User Management
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {totalUsers} total users · SUPER_ADMIN access only
          </p>
        </div>
      </div>

      {/* Role distribution */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          "SUPER_ADMIN",
          "MANUFACTURER_ADMIN",
          "FRAUD_ANALYST",
          "SUPPORT",
        ].map((role) => {
          const count =
            roleCounts.find((r) => r.role === role)?._count ?? 0
          const colors: Record<string, string> = {
            SUPER_ADMIN: "text-red-400 border-red-500/20 bg-red-500/5",
            MANUFACTURER_ADMIN: "text-blue-400 border-blue-500/20 bg-blue-500/5",
            FRAUD_ANALYST: "text-purple-400 border-purple-500/20 bg-purple-500/5",
            SUPPORT: "text-orange-400 border-orange-500/20 bg-orange-500/5",
          }
          return (
            <div
              key={role}
              className={`border rounded-xl p-4 ${colors[role]}`}
            >
              <p className="text-[10px] font-mono uppercase tracking-wider opacity-70 mb-1">
                {ROLE_LABELS[role as UserRole]}
              </p>
              <p className="text-2xl font-bold font-mono">{count}</p>
            </div>
          )
        })}
      </div>

      {/* Users table */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800/60">
              {["User", "Role", "Manufacturer", "Last Activity", "Joined", "Actions"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-mono text-gray-600 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/40">
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-gray-800/20 transition-colors"
              >
                {/* User */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name ?? ""}
                        className="w-7 h-7 rounded-full border border-gray-700"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-gray-600" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-200">
                        {user.name ?? "No name"}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="w-2.5 h-2.5 text-gray-600" />
                        <p className="text-[10px] text-gray-600 font-mono">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Role */}
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      ROLE_BADGE_COLORS[user.role]
                    }`}
                  >
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>

                {/* Manufacturer */}
                <td className="px-4 py-3">
                  {user.manufacturer ? (
                    <div>
                      <p className="text-xs text-gray-300">
                        {user.manufacturer.companyName}
                      </p>
                      <p className="text-[10px] font-mono text-gray-600 mt-0.5">
                        {user.manufacturer.onboardingStatus.replace(/_/g, " ")}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-700">—</span>
                  )}
                </td>

                {/* Last activity */}
                <td className="px-4 py-3">
                  {user.auditLogs[0] ? (
                    <div>
                      <p className="text-[10px] font-mono text-gray-500">
                        {user.auditLogs[0].action.replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] font-mono text-gray-700 mt-0.5">
                        {timeAgo(user.auditLogs[0].createdAt)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-700 font-mono">
                      No activity
                    </span>
                  )}
                </td>

                {/* Joined */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-[10px] font-mono text-gray-600">
                    <Calendar className="w-3 h-3" />
                    {new Date(user.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <RoleSelector
                    userId={user.id}
                    currentRole={user.role}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role reference */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
        <h2 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
          Role Reference
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ALL_ROLES.map((role) => (
            <div
              key={role}
              className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-800/40 border border-gray-800/40"
            >
              <Shield className="w-3.5 h-3.5 text-gray-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${ROLE_BADGE_COLORS[role]}`}
                  >
                    {ROLE_LABELS[role]}
                  </span>
                </div>
                <p className="text-[10px] text-gray-600">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Role selector form ────────────────────────────────────────────────────────

function RoleSelector({
  userId,
  currentRole,
}: {
  userId: string
  currentRole: UserRole
}) {
  return (
    <form
      action={`/api/admin/users/${userId}/role`}
      method="POST"
      className="flex items-center gap-2"
    >
      <div className="relative">
        <select
          name="role"
          defaultValue={currentRole}
          className="appearance-none bg-gray-800/60 border border-gray-700 rounded-lg pl-3 pr-7 py-1.5 text-xs text-gray-300 font-mono focus:outline-none focus:border-gray-600 cursor-pointer"
        >
          {ALL_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 pointer-events-none" />
      </div>
      <button
        type="submit"
        className="px-2.5 py-1.5 text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors whitespace-nowrap"
      >
        Update
      </button>
    </form>
  )
}