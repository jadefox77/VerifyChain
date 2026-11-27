import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { lastLagosDays, startOfLagosDay, startOfLagosMonth } from "@/lib/lagos-time"
import {
  BarChart3,
  Scan,
  ShieldCheck,
  ShieldX,
  Zap,
  TrendingUp,
  MapPin,
} from "lucide-react"

export const revalidate = 30

async function getAnalyticsData() {
  const today = startOfLagosDay()
  const thisMonthStart = startOfLagosMonth()
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const days = lastLagosDays(14)
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Every query runs at the same time, and the totals, daily and hourly
  // figures are each computed by the database in a single query. This page
  // used to make about 40 queries one after another, which was slow when the
  // database is far from the server.
  const [totals, firstOpenEvents, repeatScans, topRegions, manufacturerScanRanking, daily, hourly] = await Promise.all([
    prisma.$queryRaw<
      {
        all_time: bigint
        today: bigint
        this_month: bigint
        genuine: bigint
        flagged: bigint
        bottle_layer: bigint
        cap_layer: bigint
      }[]
    >`
      SELECT
        count(*)                                              AS all_time,
        count(*) FILTER (WHERE "scannedAt" >= ${today})          AS today,
        count(*) FILTER (WHERE "scannedAt" >= ${thisMonthStart}) AS this_month,
        count(*) FILTER (WHERE "fraudFlag" = false)              AS genuine,
        count(*) FILTER (WHERE "fraudFlag" = true)               AS flagged,
        count(*) FILTER (WHERE "scanLayer" = 'BOTTLE')           AS bottle_layer,
        count(*) FILTER (WHERE "scanLayer" = 'CAP')              AS cap_layer
      FROM "ScanLog"
    `,
    prisma.cap.count({ where: { status: "OPENED" } }),
    prisma.scanLog.count({
      where: {
        scanLayer: "BOTTLE",
        fraudFlag: false,
        bottle: { status: "OPENED" },
      },
    }),
    prisma.scanLog.groupBy({
      by: ["region"],
      _count: true,
      where: {
        region: { not: null },
        scannedAt: { gte: last30Days },
      },
      orderBy: { _count: { region: "desc" } },
      take: 8,
    }),
    prisma.manufacturer.findMany({
      where: { onboardingStatus: "ACTIVE_PRODUCTION" },
      select: {
        id: true,
        companyName: true,
        totalScans: true,
        totalFraudFlags: true,
        fraudRateCached: true,
      },
      orderBy: { totalScans: "desc" },
      take: 8,
    }),
    // Scans per Lagos day for the last 14 days
    prisma.$queryRaw<{ day: string; total: bigint; fraud: bigint }[]>`
      SELECT to_char("scannedAt" + interval '1 hour', 'YYYY-MM-DD') AS day,
             count(*) AS total,
             count(*) FILTER (WHERE "fraudFlag" = true) AS fraud
      FROM "ScanLog"
      WHERE "scannedAt" >= ${days[0].start}
      GROUP BY 1
    `,
    // Scans per hour of the day (Lagos time) over the last 7 days
    prisma.$queryRaw<{ hour: number; count: bigint }[]>`
      SELECT extract(hour FROM "scannedAt" + interval '1 hour')::int AS hour,
             count(*) AS count
      FROM "ScanLog"
      WHERE "scannedAt" >= ${last7Days}
      GROUP BY 1
    `,
  ])

  const t = totals[0]
  const totalScansAllTime = Number(t.all_time)
  const totalScansToday = Number(t.today)
  const totalScansThisMonth = Number(t.this_month)
  const genuineScans = Number(t.genuine)
  const fraudScans = Number(t.flagged)
  const bottleLayerScans = Number(t.bottle_layer)
  const capLayerScans = Number(t.cap_layer)

  const byDay = new Map(daily.map((r) => [r.day, r]))
  const dailyScans = days.map(({ start, key }) => ({
    day: start,
    total: Number(byDay.get(key)?.total ?? 0),
    fraud: Number(byDay.get(key)?.fraud ?? 0),
  }))

  const byHour = new Map(hourly.map((r) => [r.hour, Number(r.count)]))
  const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: byHour.get(hour) ?? 0,
  }))

  return {
    totalScansAllTime,
    totalScansToday,
    totalScansThisMonth,
    genuineScans,
    fraudScans,
    firstOpenEvents,
    repeatScans,
    bottleLayerScans,
    capLayerScans,
    dailyScans,
    topRegions,
    hourlyDistribution,
    manufacturerScanRanking,
    overallFraudRate:
      totalScansAllTime > 0
        ? ((fraudScans / totalScansAllTime) * 100).toFixed(2)
        : "0.00",
    firstOpenRate:
      capLayerScans > 0
        ? ((firstOpenEvents / capLayerScans) * 100).toFixed(1)
        : "0.0",
  }
}


function formatHour(hour: number): string {
  if (hour === 0) return "12am"
  if (hour === 12) return "12pm"
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

export default async function AnalyticsPage() {
  await requireAdmin()
  const data = await getAnalyticsData()

  const maxDaily = Math.max(...data.dailyScans.map((d) => d.total), 1)
  const maxHourly = Math.max(...data.hourlyDistribution.map((h) => h.count), 1)
  const maxRegion = data.topRegions[0]?._count ?? 1
  const maxMfr = data.manufacturerScanRanking[0]?.totalScans ?? 1

  // 14-day label — show every other day
  const dayLabels = data.dailyScans.map(({ day }, i) =>
    i % 2 === 0
      ? day.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })
      : ""
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">
          Analytics
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Shopper scans across all manufacturers.
        </p>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total Scans All Time",
            value: data.totalScansAllTime.toLocaleString(),
            icon: Scan,
            accent: "text-blue-400",
            sub: "All channels combined",
          },
          {
            label: "Scans Today",
            value: data.totalScansToday.toLocaleString(),
            icon: TrendingUp,
            accent: "text-green-400",
            sub: "Since midnight",
          },
          {
            label: "Platform Fraud Rate",
            value: `${data.overallFraudRate}%`,
            icon: ShieldX,
            accent:
              parseFloat(data.overallFraudRate) > 10
                ? "text-red-400"
                : parseFloat(data.overallFraudRate) > 5
                ? "text-orange-400"
                : "text-green-400",
            sub: `${data.fraudScans.toLocaleString()} flagged scans`,
          },
          {
            label: "First-Open Rate",
            value: `${data.firstOpenRate}%`,
            icon: Zap,
            accent: "text-purple-400",
            sub: `${data.firstOpenEvents.toLocaleString()} confirmed opens`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4"
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

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          {
            label: "Genuine Scans",
            value: data.genuineScans.toLocaleString(),
            icon: ShieldCheck,
            color: "text-green-400",
          },
          {
            label: "Fraud Scans",
            value: data.fraudScans.toLocaleString(),
            icon: ShieldX,
            color: "text-red-400",
          },
          {
            label: "Repeat Scans",
            value: data.repeatScans.toLocaleString(),
            icon: BarChart3,
            color: "text-yellow-400",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-3 flex items-center gap-3"
          >
            <card.icon className={`w-4 h-4 shrink-0 ${card.color}`} />
            <div>
              <p className="text-xs text-gray-400 font-medium">
                {card.label}
              </p>
              <p className={`text-lg font-bold tabular-nums ${card.color}`}>
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 14-day scan volume chart */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs text-gray-400 font-medium">
            Scans, last 14 days
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/50" />
              <span className="text-xs text-gray-500">
                Genuine
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500/50" />
              <span className="text-xs text-gray-500">
                Fraud
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-1.5 h-40">
          {data.dailyScans.map(({ total, fraud }, i) => {
            const totalPct = Math.max((total / maxDaily) * 100, total > 0 ? 2 : 0)
            const fraudPct =
              total > 0 ? (fraud / total) * totalPct : 0
            const genuinePct = totalPct - fraudPct

            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div className="w-full flex flex-col justify-end h-32 gap-px">
                  <div
                    className="w-full bg-red-500/40 rounded-t-sm"
                    style={{ height: `${fraudPct}%` }}
                  />
                  <div
                    className="w-full bg-blue-500/40"
                    style={{ height: `${genuinePct}%` }}
                  />
                </div>
                <span className="text-[8px] text-gray-500 text-center">
                  {dayLabels[i]}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-800/40 flex justify-between">
          <span className="text-xs text-gray-400">
            Total:{" "}
            {data.dailyScans
              .reduce((s, d) => s + d.total, 0)
              .toLocaleString()}{" "}
            scans
          </span>
          <span className="text-xs text-gray-400">
            Peak:{" "}
            {Math.max(...data.dailyScans.map((d) => d.total)).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Scan layer + channel breakdown + hourly heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scan layer breakdown */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs text-gray-400 mb-4 font-medium">
            Scan Layer Breakdown
          </h2>

          <div className="space-y-4">
            {[
              {
                label: "Bottle Layer",
                value: data.bottleLayerScans,
                total: data.totalScansAllTime,
                color: "bg-blue-500/50",
              },
              {
                label: "Cap Layer",
                value: data.capLayerScans,
                total: data.totalScansAllTime,
                color: "bg-purple-500/50",
              },
            ].map((item) => {
              const pct =
                item.total > 0
                  ? ((item.value / item.total) * 100).toFixed(1)
                  : "0.0"
              return (
                <div key={item.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-gray-400">
                      {item.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.value.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}

          </div>
        </div>

        {/* Hourly distribution */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs text-gray-400 mb-4 font-medium">
            Scans by hour (Lagos time), last 7 days
          </h2>

          {data.hourlyDistribution.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-gray-400">
                No scan data yet
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {Array.from({ length: 24 }, (_, hour) => {
                const entry = data.hourlyDistribution.find(
                  (h) => h.hour === hour
                )
                const count = entry?.count ?? 0
                const widthPct =
                  maxHourly > 0
                    ? Math.max((count / maxHourly) * 100, count > 0 ? 3 : 0)
                    : 0
                const isPeak = count === maxHourly && count > 0

                return (
                  <div key={hour} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500 w-8 text-right shrink-0">
                      {formatHour(hour)}
                    </span>
                    <div className="flex-1 h-3 bg-gray-800/60 rounded-sm overflow-hidden">
                      <div
                        className={`h-full rounded-sm transition-all ${
                          isPeak ? "bg-blue-400/70" : "bg-blue-500/30"
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    {count > 0 && (
                      <span className="text-[11px] text-gray-500 w-8 shrink-0">
                        {count}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top regions */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs text-gray-400 mb-4 font-medium">
            Top states, last 30 days
          </h2>

          <div className="space-y-3">
            {data.topRegions.length === 0 ? (
              <p className="text-xs text-gray-400">
                No scans with a location yet. Location is only recorded when the shopper shares it.
              </p>
            ) : (
              data.topRegions.map((r, i) => {
                const pct = Math.round((r._count / maxRegion) * 100)
                return (
                  <div key={r.region}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-4">
                          {i + 1}
                        </span>
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-300">
                          {r.region}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {r._count.toLocaleString()}
                      </span>
                    </div>
                    <div className="ml-10 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500/40 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Manufacturer scan rankings */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/60">
          <h2 className="text-xs text-gray-400 font-medium">
            Manufacturer Scan Rankings
          </h2>
        </div>
        <div className="table-scroll">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-800/40">
              {[
                "#",
                "Manufacturer",
                "Total Scans",
                "Fraud Flags",
                "Fraud Rate",
                "Scan Volume",
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
            {data.manufacturerScanRanking.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-xs text-gray-400"
                >
                  No active manufacturers
                </td>
              </tr>
            ) : (
              data.manufacturerScanRanking.map((m, i) => {
                const volumePct =
                  maxMfr > 0
                    ? Math.round((m.totalScans / maxMfr) * 100)
                    : 0
                const fraudAccent =
                  m.fraudRateCached > 15
                    ? "text-red-400"
                    : m.fraudRateCached > 5
                    ? "text-orange-400"
                    : "text-green-400"

                return (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-800/20 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-400">
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-sm text-gray-300">
                        {m.companyName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-blue-400">
                        {m.totalScans.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-red-400">
                        {m.totalFraudFlags.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-bold ${fraudAccent}`}
                      >
                        {m.fraudRateCached.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 w-48">
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500/40 rounded-full"
                          style={{ width: `${volumePct}%` }}
                        />
                      </div>
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