import { requireSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import {
  Building2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { PLAN_LIMITS, PLAN_PRICES, describeUsage, monthWindow } from "@/lib/plans"

export const revalidate = 30

const PLAN_CONFIG = {
  FREE: {
    label: "Free",
    color: "text-gray-400",
    badge: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
  STARTER: {
    label: "Starter",
    color: "text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  PROFESSIONAL: {
    label: "Professional",
    color: "text-purple-400",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  ENTERPRISE: {
    label: "Enterprise",
    color: "text-orange-400",
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
}

const STATUS_CONFIG = {
  ACTIVE: {
    label: "Active",
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  PAST_DUE: {
    label: "Past Due",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  SUSPENDED: {
    label: "Suspended",
    badge: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
  },
}

async function getBillingData() {
  // Batch 1
  const [manufacturers, planCounts, statusCounts] = await Promise.all([
    prisma.manufacturer.findMany({
      where: { onboardingStatus: "ACTIVE_PRODUCTION" },
      select: {
        id: true,
        companyName: true,
        rcNumber: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        totalBottlesGenerated: true,
        estimatedBottlesPerMonth: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.manufacturer.groupBy({
      by: ["subscriptionPlan"],
      _count: true,
      where: { onboardingStatus: "ACTIVE_PRODUCTION" },
    }),
    prisma.manufacturer.groupBy({
      by: ["subscriptionStatus"],
      _count: true,
      where: { onboardingStatus: "ACTIVE_PRODUCTION" },
    }),
  ])

  // Units serialised this month per manufacturer, the figure plan limits apply to
  const monthlyUnits = await prisma.bottle.groupBy({
    by: ["manufacturerId"],
    _count: true,
    where: { createdAt: { gte: monthWindow().start } },
  })
  const unitsThisMonth = new Map(monthlyUnits.map((r) => [r.manufacturerId, r._count]))

  // Batch 2
  const [totalBottlesAllTime, pastDueCount] = await Promise.all([
    prisma.bottle.count(),
    prisma.manufacturer.count({
      where: {
        subscriptionStatus: "PAST_DUE",
        onboardingStatus: "ACTIVE_PRODUCTION",
      },
    }),
  ])

  // Compute MRR from plan counts
  const mrr = planCounts.reduce((sum, p) => {
    const price = PLAN_PRICES[p.subscriptionPlan] ?? 0
    return sum + price * p._count
  }, 0)

  return {
    manufacturers,
    unitsThisMonth,
    planCounts,
    statusCounts,
    totalBottlesAllTime,
    pastDueCount,
    mrr,
    totalActive: manufacturers.length,
  }
}

export default async function AdminBillingPage() {
  await requireSuperAdmin()
  const data = await getBillingData()

  const activeCount =
    data.statusCounts.find((s) => s.subscriptionStatus === "ACTIVE")
      ?._count ?? 0
  const pastDueCount =
    data.statusCounts.find((s) => s.subscriptionStatus === "PAST_DUE")
      ?._count ?? 0

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">
          Billing & Subscriptions
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Platform-wide subscription management · SUPER_ADMIN only
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Est. Monthly Revenue",
            value: `₦${data.mrr.toLocaleString()}`,
            sub: "Based on active plans",
            accent: "text-green-400",
            border: "border-green-500/20",
            bg: "bg-green-500/5",
          },
          {
            label: "Active Subscriptions",
            value: activeCount,
            sub: "Paying manufacturers",
            accent: "text-blue-400",
            border: "border-blue-500/20",
            bg: "bg-blue-500/5",
          },
          {
            label: "Past Due",
            value: pastDueCount,
            sub: "Require follow-up",
            accent: pastDueCount > 0 ? "text-red-400" : "text-gray-500",
            border: pastDueCount > 0 ? "border-red-500/20" : "border-gray-800/60",
            bg: pastDueCount > 0 ? "bg-red-500/5" : "bg-gray-900/40",
          },
          {
            label: "Total Bottles Serialized",
            value: data.totalBottlesAllTime.toLocaleString(),
            sub: "All time platform total",
            accent: "text-purple-400",
            border: "border-purple-500/20",
            bg: "bg-purple-500/5",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`border rounded-xl p-4 ${card.border} ${card.bg}`}
          >
            <p className="text-xs text-gray-500 mb-2 font-medium">
              {card.label}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${card.accent}`}>
              {card.value}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
        <h2 className="text-xs text-gray-400 mb-4 font-medium">
          Plan Distribution
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"] as const).map(
            (plan) => {
              const count =
                data.planCounts.find((p) => p.subscriptionPlan === plan)
                  ?._count ?? 0
              const config = PLAN_CONFIG[plan]
              const price = PLAN_PRICES[plan]
              const limit = PLAN_LIMITS[plan]

              return (
                <div
                  key={plan}
                  className="border border-gray-800/60 rounded-xl p-4 bg-gray-900/40"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${config.badge}`}
                    >
                      {config.label}
                    </span>
                    <span className={`text-2xl font-bold tabular-nums ${config.color}`}>
                      {count}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400">
                      {price === 0
                        ? "Free"
                        : `₦${price.toLocaleString()}/mo`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {limit === Infinity
                        ? "Unlimited bottles"
                        : `${limit.toLocaleString()} bottles/mo`}
                    </p>
                    <p className="text-xs text-gray-400">
                      Est. ₦
                      {(price * count).toLocaleString()}/mo
                    </p>
                  </div>
                </div>
              )
            }
          )}
        </div>
      </div>

      {/* Manufacturer subscription table */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/60">
          <h2 className="text-xs text-gray-400 font-medium">
            Manufacturer Subscriptions
          </h2>
        </div>
        <div className="table-scroll">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-800/40">
              {[
                "Manufacturer",
                "Plan",
                "Status",
                "Units this month",
                "Monthly limit",
                "Usage",
                "Expected per month",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/40">
            {data.manufacturers.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-xs text-gray-400"
                >
                  No active manufacturers
                </td>
              </tr>
            ) : (
              data.manufacturers.map((m) => {
                const planConfig = PLAN_CONFIG[m.subscriptionPlan]
                const statusConfig = STATUS_CONFIG[m.subscriptionStatus]
                const planLimit = PLAN_LIMITS[m.subscriptionPlan]
                const price = PLAN_PRICES[m.subscriptionPlan]
                const used = data.unitsThisMonth.get(m.id) ?? 0
                const usage = describeUsage(m.subscriptionPlan, used)

                const usagePct = usage.unlimited ? null : usage.percent

                const usageColor =
                  usage.unlimited
                    ? "bg-blue-500/40"
                    : usage.state === "over"
                    ? "bg-red-500/60"
                    : usage.state === "near"
                    ? "bg-orange-500/60"
                    : "bg-green-500/40"

                const isOverLimit = usage.state === "over"

                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-gray-800/20 transition-colors ${
                      m.subscriptionStatus === "PAST_DUE"
                        ? "bg-red-500/5"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-sm text-gray-200">
                            {m.companyName}
                          </p>
                          <p className="font-mono text-xs text-gray-400">
                            {m.rcNumber ?? "No RC"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${planConfig.badge}`}
                      >
                        {planConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${statusConfig.badge}`}
                      >
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">
                          {used.toLocaleString()}
                        </span>
                        {isOverLimit && (
                          <AlertTriangle className="w-3 h-3 text-red-400" aria-label="Allowance used up, new batches paused" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {planLimit === Infinity
                          ? "Unlimited"
                          : planLimit.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 w-32">
                      {usagePct === null ? (
                        <span className="text-xs text-blue-400">
                          Unlimited
                        </span>
                      ) : (
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[11px] text-gray-400">
                              {usagePct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${usageColor}`}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {price === 0
                          ? "Free"
                          : `₦${price.toLocaleString()}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/manufacturers/${m.id}`}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-400 transition-colors"
                      >
                        View
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}