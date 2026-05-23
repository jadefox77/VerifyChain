import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { Cpu, Package, AlertTriangle, TrendingUp, Building2, ChevronRight } from "lucide-react"
import Link from "next/link"

export const revalidate = 30

async function getSerializationMetrics() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  thisMonthStart.setHours(0, 0, 0, 0)

  const [
    totalAllTime,
    totalToday,
    totalThisMonth,
    totalCaps,
    flaggedBottles,
    batchesToday,
    batchesThisMonth,
    manufacturerBreakdown,
    recentBatches,
    dailyThroughput,
  ] = await Promise.all([
    // Total bottles ever serialized
    prisma.bottle.count(),

    // Serialized today
    prisma.bottle.count({
      where: { createdAt: { gte: today } },
    }),

    // Serialized this month
    prisma.bottle.count({
      where: { createdAt: { gte: thisMonthStart } },
    }),

    // Total caps generated
    prisma.cap.count(),

    // Flagged bottles — serialization integrity issues
    prisma.bottle.count({
      where: { status: "FLAGGED" },
    }),

    // Batches generated today
    prisma.batch.count({
      where: { createdAt: { gte: today } },
    }),

    // Batches this month
    prisma.batch.count({
      where: { createdAt: { gte: thisMonthStart } },
    }),

    // Per-manufacturer serialization breakdown
    prisma.manufacturer.findMany({
      where: { onboardingStatus: "ACTIVE_PRODUCTION" },
      select: {
        id: true,
        companyName: true,
        totalBottlesGenerated: true,
        subscriptionPlan: true,
        estimatedBottlesPerMonth: true,
        _count: {
          select: { batches: true, bottles: true },
        },
      },
      orderBy: { totalBottlesGenerated: "desc" },
      take: 10,
    }),

    // Recent batch generation activity
    prisma.batch.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        batchCode: true,
        bottleCount: true,
        createdAt: true,
        targetRegion: true,
        manufacturer: {
          select: { id: true, companyName: true },
        },
        product: {
          select: { name: true },
        },
      },
    }),

    // Daily throughput — last 7 days
    Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const day = new Date()
        day.setDate(day.getDate() - (6 - i))
        day.setHours(0, 0, 0, 0)
        const next = new Date(day)
        next.setDate(next.getDate() + 1)
        return prisma.bottle
          .count({ where: { createdAt: { gte: day, lt: next } } })
          .then((count) => ({ day, count }))
      })
    ),
  ])

  // Pairing integrity check — bottles without caps
  const bottlesWithoutCaps = await prisma.bottle.count({
    where: { cap: null },
  })

  return {
    totalAllTime,
    totalToday,
    totalThisMonth,
    totalCaps,
    flaggedBottles,
    batchesToday,
    batchesThisMonth,
    manufacturerBreakdown,
    recentBatches,
    dailyThroughput,
    bottlesWithoutCaps,
    pairingIntegrity:
      totalAllTime > 0
        ? (((totalAllTime - bottlesWithoutCaps) / totalAllTime) * 100).toFixed(2)
        : "100.00",
  }
}

const PLAN_LIMITS: Record<string, number> = {
  FREE: 5000,
  STARTER: 50000,
  PROFESSIONAL: 500000,
  ENTERPRISE: Infinity,
}

export default async function SerializationMonitorPage() {
  await requireAdmin()
  const metrics = await getSerializationMetrics()

  const maxDailyCount = Math.max(...metrics.dailyThroughput.map((d) => d.count), 1)

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const todayIndex = new Date().getDay()
  const orderedLabels = Array.from(
    { length: 7 },
    (_, i) => dayLabels[(todayIndex - 6 + i + 7) % 7]
  )

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">
          Serialization Monitor
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-0.5">
          Platform-wide identity generation and pairing integrity
        </p>
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total Serialized",
            value: metrics.totalAllTime.toLocaleString(),
            sub: "All time — all manufacturers",
            icon: Cpu,
            accent: "text-blue-400",
            border: "border-gray-800/60",
          },
          {
            label: "Serialized Today",
            value: metrics.totalToday.toLocaleString(),
            sub: `${metrics.batchesToday} batch${metrics.batchesToday !== 1 ? "es" : ""} generated`,
            icon: TrendingUp,
            accent: "text-green-400",
            border: "border-gray-800/60",
          },
          {
            label: "This Month",
            value: metrics.totalThisMonth.toLocaleString(),
            sub: `${metrics.batchesThisMonth} batches`,
            icon: Package,
            accent: "text-purple-400",
            border: "border-gray-800/60",
          },
          {
            label: "Pairing Integrity",
            value: `${metrics.pairingIntegrity}%`,
            sub:
              metrics.bottlesWithoutCaps > 0
                ? `${metrics.bottlesWithoutCaps} bottles unpaired`
                : "All bottles paired",
            icon: AlertTriangle,
            accent:
              metrics.bottlesWithoutCaps > 0
                ? "text-red-400"
                : "text-green-400",
            border:
              metrics.bottlesWithoutCaps > 0
                ? "border-red-500/20"
                : "border-gray-800/60",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`bg-gray-900/60 border rounded-xl p-4 ${card.border}`}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                {card.label}
              </p>
              <card.icon className={`w-3.5 h-3.5 ${card.accent}`} />
            </div>
            <p className={`text-2xl font-bold font-mono ${card.accent}`}>
              {card.value}
            </p>
            <p className="text-[10px] text-gray-600 font-mono mt-1">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total Caps Generated",
            value: metrics.totalCaps.toLocaleString(),
          },
          {
            label: "Flagged Bottles",
            value: metrics.flaggedBottles.toLocaleString(),
          },
          {
            label: "Bottles Without Caps",
            value: metrics.bottlesWithoutCaps.toLocaleString(),
          },
          {
            label: "Cap / Bottle Ratio",
            value:
              metrics.totalAllTime > 0
                ? (metrics.totalCaps / metrics.totalAllTime).toFixed(3)
                : "—",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-3"
          >
            <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-1">
              {card.label}
            </p>
            <p className="text-lg font-bold font-mono text-gray-300">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Throughput chart + recent batches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily throughput */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-4">
            Daily Serialization Throughput — Last 7 Days
          </h2>

          <div className="flex items-end gap-2 h-36">
            {metrics.dailyThroughput.map(({ count }, i) => {
              const heightPct = Math.max((count / maxDailyCount) * 100, 2)
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span className="text-[9px] font-mono text-gray-600">
                    {count > 0 ? count.toLocaleString() : ""}
                  </span>
                  <div className="w-full flex flex-col justify-end h-28">
                    <div
                      className="w-full bg-blue-500/40 rounded-t-sm hover:bg-blue-500/60 transition-colors"
                      style={{ height: `${heightPct}%` }}
                      title={`${count.toLocaleString()} bottles`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-gray-600">
                    {orderedLabels[i]}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-800/40 flex justify-between">
            <span className="text-[10px] font-mono text-gray-600">
              Total this week:{" "}
              {metrics.dailyThroughput
                .reduce((s, d) => s + d.count, 0)
                .toLocaleString()}{" "}
              bottles
            </span>
            <span className="text-[10px] font-mono text-gray-600">
              Peak:{" "}
              {Math.max(
                ...metrics.dailyThroughput.map((d) => d.count)
              ).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Recent batch activity */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-800/60">
            <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
              Recent Batch Generation
            </h2>
          </div>
          <div className="divide-y divide-gray-800/40">
            {metrics.recentBatches.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-gray-600 font-mono">
                  No batches generated yet
                </p>
              </div>
            ) : (
              metrics.recentBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-800/20 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-300">
                        {batch.batchCode}
                      </span>
                      {batch.targetRegion && (
                        <span className="text-[9px] font-mono text-gray-600 border border-gray-800 rounded px-1">
                          {batch.targetRegion}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Building2 className="w-3 h-3 text-gray-700" />
                      <span className="text-[10px] text-gray-600 truncate">
                        {batch.manufacturer.companyName}
                      </span>
                      <span className="text-gray-700">·</span>
                      <span className="text-[10px] text-gray-600">
                        {batch.product?.name ?? "No product"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs font-mono text-blue-400">
                      {batch.bottleCount.toLocaleString()}
                    </p>
                    <p className="text-[9px] font-mono text-gray-600">
                      {new Date(batch.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Per-manufacturer breakdown */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/60">
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Serialization by Manufacturer
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800/40">
              {[
                "Manufacturer",
                "Plan",
                "Total Bottles",
                "Total Batches",
                "Monthly Estimate",
                "Plan Usage",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-[10px] font-mono text-gray-600 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/40">
            {metrics.manufacturerBreakdown.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-xs text-gray-600 font-mono"
                >
                  No active manufacturers
                </td>
              </tr>
            ) : (
              metrics.manufacturerBreakdown.map((m) => {
                const planLimit = PLAN_LIMITS[m.subscriptionPlan]
                const usagePct =
                  planLimit === Infinity
                    ? null
                    : Math.min(
                        (m.totalBottlesGenerated / planLimit) * 100,
                        100
                      )
                const usageColor =
                  usagePct === null
                    ? "bg-blue-500/40"
                    : usagePct > 90
                    ? "bg-red-500/60"
                    : usagePct > 70
                    ? "bg-orange-500/60"
                    : "bg-green-500/40"

                return (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-800/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-300">
                        {m.companyName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-500">
                        {m.subscriptionPlan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-blue-400">
                        {m.totalBottlesGenerated.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-400">
                        {m._count.batches.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-500">
                        {m.estimatedBottlesPerMonth
                          ? m.estimatedBottlesPerMonth.toLocaleString()
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 w-40">
                      {usagePct === null ? (
                        <span className="text-[10px] font-mono text-blue-400">
                          Unlimited
                        </span>
                      ) : (
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[9px] font-mono text-gray-600">
                              {usagePct.toFixed(1)}%
                            </span>
                            <span className="text-[9px] font-mono text-gray-700">
                              of {planLimit.toLocaleString()}
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
                      <Link
                        href={`/admin/manufacturers/${m.id}`}
                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-400 transition-colors font-mono"
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
  )
}