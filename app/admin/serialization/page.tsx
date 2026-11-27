import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import {
  Cpu,
  Package,
  AlertTriangle,
  TrendingUp,
  Building2,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { lastLagosDays, startOfLagosDay, startOfLagosMonth } from "@/lib/lagos-time"
import { describeUsage } from "@/lib/plans"

export const revalidate = 30

async function getSerializationMetrics() {
  const today = startOfLagosDay()
  const thisMonthStart = startOfLagosMonth()
  const days = lastLagosDays(7)

  // All queries run at the same time, and the unit totals and daily counts
  // are each one query, instead of about 20 queries one after another.
  const [
    unitTotals,
    totalCaps,
    batchesToday,
    batchesThisMonth,
    pairedProducts,
    singleProducts,
    manufacturerBreakdown,
    recentBatches,
    daily,
    monthlyUnits,
  ] = await Promise.all([
    prisma.$queryRaw<{ all_time: bigint; today: bigint; this_month: bigint; flagged: bigint; without_cap: bigint }[]>`
      SELECT
        count(*)                                                AS all_time,
        count(*) FILTER (WHERE b."createdAt" >= ${today})          AS today,
        count(*) FILTER (WHERE b."createdAt" >= ${thisMonthStart}) AS this_month,
        count(*) FILTER (WHERE b."status" = 'FLAGGED')             AS flagged,
        count(*) FILTER (WHERE c."id" IS NULL)                     AS without_cap
      FROM "Bottle" b
      LEFT JOIN "Cap" c ON c."bottleId" = b."id"
    `,
    prisma.cap.count(),
    prisma.batch.count({ where: { createdAt: { gte: today } } }),
    prisma.batch.count({ where: { createdAt: { gte: thisMonthStart } } }),
    prisma.product.count({ where: { authMode: "PAIRED" } }),
    prisma.product.count({ where: { authMode: "SINGLE" } }),
    prisma.manufacturer.findMany({
      where: { onboardingStatus: "ACTIVE_PRODUCTION" },
      select: {
        id: true,
        companyName: true,
        totalBottlesGenerated: true,
        subscriptionPlan: true,
        estimatedBottlesPerMonth: true,
        _count: { select: { batches: true, bottles: true } },
      },
      orderBy: { totalBottlesGenerated: "desc" },
      take: 10,
    }),
    prisma.batch.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        batchCode: true,
        bottleCount: true,
        createdAt: true,
        targetRegion: true,
        manufacturer: { select: { id: true, companyName: true } },
        product: { select: { name: true, authMode: true } },
      },
    }),
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT to_char("createdAt" + interval '1 hour', 'YYYY-MM-DD') AS day, count(*) AS count
      FROM "Bottle"
      WHERE "createdAt" >= ${days[0].start}
      GROUP BY 1
    `,
    prisma.bottle.groupBy({
      by: ["manufacturerId"],
      _count: true,
      where: { createdAt: { gte: thisMonthStart } },
    }),
  ])

  const u = unitTotals[0]
  const totalAllTime = Number(u.all_time)
  const totalToday = Number(u.today)
  const totalThisMonth = Number(u.this_month)
  const flaggedBottles = Number(u.flagged)
  const bottlesWithoutCaps = Number(u.without_cap)

  const byDay = new Map(daily.map((r) => [r.day, Number(r.count)]))
  const dailyThroughput = days.map(({ start, key }) => ({ day: start, count: byDay.get(key) ?? 0 }))
  const unitsThisMonth = new Map(monthlyUnits.map((r) => [r.manufacturerId, r._count]))

  return {
    totalAllTime,
    totalToday,
    totalThisMonth,
    totalCaps,
    flaggedBottles,
    bottlesWithoutCaps,
    batchesToday,
    batchesThisMonth,
    pairedProducts,
    singleProducts,
    manufacturerBreakdown,
    recentBatches,
    dailyThroughput,
    unitsThisMonth,
    pairingIntegrity:
      totalAllTime > 0
        ? (
            ((totalAllTime - bottlesWithoutCaps) / totalAllTime) *
            100
          ).toFixed(2)
        : "100.00",
  }
}

export default async function SerializationPage() {
  await requireAdmin()
  const metrics = await getSerializationMetrics()

  const maxDaily = Math.max(
    ...metrics.dailyThroughput.map((d) => d.count),
    1
  )

  const orderedLabels = metrics.dailyThroughput.map(({ day }) =>
    day.toLocaleDateString("en-NG", { weekday: "short", timeZone: "Africa/Lagos" })
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Serialisation
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Codes generated for every unit, cap pairing and batches across all manufacturers.
          </p>
        </div>
        <Link
          href="/admin/serialization/pairing"
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs hover:bg-blue-500/20 transition-colors"
        >
          <Cpu className="w-3.5 h-3.5" />
          Pairing
        </Link>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Units serialised",
            value: metrics.totalAllTime.toLocaleString(),
            sub: "All time",
            icon: Cpu,
            accent: "text-blue-400",
            border: "border-gray-800/60",
          },
          {
            label: "Serialised today",
            value: metrics.totalToday.toLocaleString(),
            sub: `${metrics.batchesToday} batches`,
            icon: TrendingUp,
            accent: "text-green-400",
            border: "border-gray-800/60",
          },
          {
            label: "Pairing Integrity",
            value: `${metrics.pairingIntegrity}%`,
            sub:
              metrics.bottlesWithoutCaps > 0
                ? `${metrics.bottlesWithoutCaps} unpaired`
                : "All paired",
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
          {
            label: "This Month",
            value: metrics.totalThisMonth.toLocaleString(),
            sub: `${metrics.batchesThisMonth} batches`,
            icon: Package,
            accent: "text-purple-400",
            border: "border-gray-800/60",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`bg-gray-900/60 border rounded-xl p-4 ${card.border}`}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">
                {card.label}
              </p>
              <card.icon className={`w-3.5 h-3.5 ${card.accent}`} />
            </div>
            <p className={`text-2xl font-bold tabular-nums ${card.accent}`}>
              {card.value}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Auth mode breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            label: "Paired Mode Products",
            value: metrics.pairedProducts,
            sub: "Bottle + Hidden Cap QR",
            color: "text-blue-400",
            border: "border-blue-500/20",
            bg: "bg-blue-500/5",
          },
          {
            label: "Single Mode Products",
            value: metrics.singleProducts,
            sub: "One QR per unit",
            color: "text-green-400",
            border: "border-green-500/20",
            bg: "bg-green-500/5",
          },
          {
            label: "Total Caps Generated",
            value: metrics.totalCaps.toLocaleString(),
            sub: `${metrics.flaggedBottles} flagged bottles`,
            color: "text-purple-400",
            border: "border-purple-500/20",
            bg: "bg-purple-500/5",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`border rounded-xl p-4 ${card.border} ${card.bg}`}
          >
            <p className="text-xs text-gray-500 mb-1 font-medium">
              {card.label}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${card.color}`}>
              {card.value}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Throughput chart + recent batches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily throughput */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs text-gray-400 mb-4 font-medium">
            Units serialised per day, last 7 days
          </h2>
          <div className="flex items-end gap-2 h-36">
            {metrics.dailyThroughput.map(({ count }, i) => {
              const heightPct = Math.max(
                (count / maxDaily) * 100,
                count > 0 ? 2 : 0
              )
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  {count > 0 && (
                    <span className="text-[11px] text-gray-400">
                      {count.toLocaleString()}
                    </span>
                  )}
                  <div className="w-full flex flex-col justify-end h-28">
                    <div
                      className="w-full bg-blue-500/40 rounded-t-sm hover:bg-blue-500/60 transition-colors"
                      style={{ height: `${heightPct}%` }}
                      title={`${count.toLocaleString()} bottles`}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {orderedLabels[i]}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800/40 flex justify-between">
            <span className="text-xs text-gray-400">
              Week total:{" "}
              {metrics.dailyThroughput
                .reduce((s, d) => s + d.count, 0)
                .toLocaleString()}
            </span>
            <span className="text-xs text-gray-400">
              Peak:{" "}
              {Math.max(
                ...metrics.dailyThroughput.map((d) => d.count)
              ).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Recent batches */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-800/60">
            <h2 className="text-xs text-gray-400 font-medium">
              Recent Batch Generation
            </h2>
          </div>
          <div className="divide-y divide-gray-800/40">
            {metrics.recentBatches.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-gray-400">
                  No batches yet
                </p>
              </div>
            ) : (
              metrics.recentBatches.map((batch) => {
                const isPaired =
                  batch.product?.authMode === "PAIRED"
                return (
                  <div
                    key={batch.id}
                    className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-800/20 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-300">
                          {batch.batchCode}
                        </span>
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded border ${
                            isPaired
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-green-500/10 text-green-400 border-green-500/20"
                          }`}
                        >
                          {isPaired ? "Paired" : "Single"}
                        </span>
                        {batch.targetRegion && (
                          <span className="text-[11px] text-gray-400 border border-gray-800 rounded px-1">
                            {batch.targetRegion}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Building2 className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-400 truncate">
                          {batch.manufacturer.companyName}
                        </span>
                        <span className="text-gray-500">·</span>
                        <span className="text-xs text-gray-400">
                          {batch.product?.name ?? "No product"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs text-blue-400">
                        {batch.bottleCount.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {new Date(batch.createdAt).toLocaleDateString(
                          "en-NG",
                          { day: "numeric", month: "short" }
                        )}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Manufacturer breakdown table */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/60">
          <h2 className="text-xs text-gray-400 font-medium">
            Serialization by Manufacturer
          </h2>
        </div>
        <div className="table-scroll">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-800/40">
              {[
                "Manufacturer",
                "Plan",
                "Total Bottles",
                "Batches",
                "Est. Monthly",
                "Plan usage this month",
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
            {metrics.manufacturerBreakdown.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-xs text-gray-400"
                >
                  No active manufacturers
                </td>
              </tr>
            ) : (
              metrics.manufacturerBreakdown.map((m) => {
                const usage = describeUsage(m.subscriptionPlan, metrics.unitsThisMonth.get(m.id) ?? 0)
                const usagePct = usage.unlimited ? null : usage.percent
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
                      <span className="text-xs text-gray-500">
                        {m.subscriptionPlan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-blue-400">
                        {m.totalBottlesGenerated.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {m._count.batches.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {m.estimatedBottlesPerMonth
                          ? m.estimatedBottlesPerMonth.toLocaleString()
                          : "Not given"}
                      </span>
                    </td>
                    <td className="px-4 py-3 w-40">
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
                            <span className="text-[11px] text-gray-500">
                              of {usage.limit.toLocaleString()}
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