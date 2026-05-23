import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import {
  BarChart3,
  Scan,
  ShieldCheck,
  ShieldX,
  Zap,
  TrendingUp,
  MapPin,
  Smartphone,
} from "lucide-react"

export const revalidate = 30

async function getAnalyticsData() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  thisMonthStart.setHours(0, 0, 0, 0)

  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalScansAllTime,
    totalScansToday,
    totalScansThisMonth,
    genuineScans,
    fraudScans,
    firstOpenEvents,
    repeatScans,
    bottleLayerScans,
    capLayerScans,
    whatsappScans,
    dailyScans,
    topRegions,
    hourlyDistribution,
    manufacturerScanRanking,
  ] = await Promise.all([
    // Totals
    prisma.scanLog.count(),
    prisma.scanLog.count({ where: { scannedAt: { gte: today } } }),
    prisma.scanLog.count({ where: { scannedAt: { gte: thisMonthStart } } }),

    // Genuine vs fraud
    prisma.scanLog.count({ where: { fraudFlag: false } }),
    prisma.scanLog.count({ where: { fraudFlag: true } }),

    // First open events — cap layer scans that resulted in OPENED status
    prisma.cap.count({ where: { status: "OPENED" } }),

    // Repeat scans — bottle scans where bottle was already OPENED
    prisma.scanLog.count({
      where: {
        scanLayer: "BOTTLE",
        fraudFlag: false,
        bottle: { status: "OPENED" },
      },
    }),

    // Layer breakdown
    prisma.scanLog.count({ where: { scanLayer: "BOTTLE" } }),
    prisma.scanLog.count({ where: { scanLayer: "CAP" } }),

    // WhatsApp vs direct
    prisma.scanLog.count({ where: { channel: "whatsapp" } }),

    // Daily scans — last 14 days
    Promise.all(
      Array.from({ length: 14 }, (_, i) => {
        const day = new Date()
        day.setDate(day.getDate() - (13 - i))
        day.setHours(0, 0, 0, 0)
        const next = new Date(day)
        next.setDate(next.getDate() + 1)
        return Promise.all([
          prisma.scanLog.count({
            where: { scannedAt: { gte: day, lt: next } },
          }),
          prisma.scanLog.count({
            where: {
              scannedAt: { gte: day, lt: next },
              fraudFlag: true,
            },
          }),
        ]).then(([total, fraud]) => ({ day, total, fraud }))
      })
    ),

    // Top regions by scan volume
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

    // Hourly distribution — last 7 days
    prisma.$queryRaw<{ hour: number; count: bigint }[]>`
      SELECT
        EXTRACT(HOUR FROM "scannedAt") AS hour,
        COUNT(*) AS count
      FROM "ScanLog"
      WHERE "scannedAt" >= ${last7Days}
      GROUP BY hour
      ORDER BY hour ASC
    `,

    // Top manufacturers by scan volume
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
  ])

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
    whatsappScans,
    directScans: totalScansAllTime - whatsappScans,
    dailyScans,
    topRegions,
    hourlyDistribution: hourlyDistribution.map((h) => ({
      hour: Number(h.hour),
      count: Number(h.count),
    })),
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
      ? day.toLocaleDateString("en-NG", { day: "numeric", month: "short" })
      : ""
  )

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">
          Verification Analytics
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-0.5">
          Platform-wide scan intelligence · All manufacturers combined
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
            label: "WhatsApp Scans",
            value: data.whatsappScans.toLocaleString(),
            icon: Smartphone,
            color: "text-blue-400",
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
              <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
                {card.label}
              </p>
              <p className={`text-lg font-bold font-mono ${card.color}`}>
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 14-day scan volume chart */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Scan Volume — Last 14 Days
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/50" />
              <span className="text-[10px] font-mono text-gray-500">
                Genuine
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500/50" />
              <span className="text-[10px] font-mono text-gray-500">
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
                <span className="text-[8px] font-mono text-gray-700 text-center">
                  {dayLabels[i]}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-800/40 flex justify-between">
          <span className="text-[10px] font-mono text-gray-600">
            Total:{" "}
            {data.dailyScans
              .reduce((s, d) => s + d.total, 0)
              .toLocaleString()}{" "}
            scans
          </span>
          <span className="text-[10px] font-mono text-gray-600">
            Peak:{" "}
            {Math.max(...data.dailyScans.map((d) => d.total)).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Scan layer + channel breakdown + hourly heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scan layer breakdown */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-4">
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
                    <span className="text-xs font-mono text-gray-500">
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

            <div className="pt-3 border-t border-gray-800/40 space-y-3">
              <h3 className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
                Channel
              </h3>
              {[
                {
                  label: "WhatsApp",
                  value: data.whatsappScans,
                  color: "bg-green-500/50",
                },
                {
                  label: "Direct QR",
                  value: data.directScans,
                  color: "bg-blue-500/30",
                },
              ].map((item) => {
                const pct =
                  data.totalScansAllTime > 0
                    ? (
                        (item.value / data.totalScansAllTime) *
                        100
                      ).toFixed(1)
                    : "0.0"
                return (
                  <div key={item.label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-gray-400">
                        {item.label}
                      </span>
                      <span className="text-xs font-mono text-gray-500">
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
        </div>

        {/* Hourly distribution */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-4">
            Hourly Activity — Last 7 Days
          </h2>

          {data.hourlyDistribution.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-gray-600 font-mono">
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
                    <span className="text-[9px] font-mono text-gray-700 w-8 text-right shrink-0">
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
                      <span className="text-[9px] font-mono text-gray-700 w-8 shrink-0">
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
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-4">
            Top Regions — Last 30 Days
          </h2>

          <div className="space-y-3">
            {data.topRegions.length === 0 ? (
              <p className="text-xs text-gray-600 font-mono">
                No regional data — location not captured in scan logs
              </p>
            ) : (
              data.topRegions.map((r, i) => {
                const pct = Math.round((r._count / maxRegion) * 100)
                return (
                  <div key={r.region}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-gray-700 w-4">
                          {i + 1}
                        </span>
                        <MapPin className="w-3 h-3 text-gray-600" />
                        <span className="text-xs text-gray-300">
                          {r.region}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">
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
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Manufacturer Scan Rankings
          </h2>
        </div>
        <table className="w-full">
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
                  className="px-4 py-2.5 text-left text-[10px] font-mono text-gray-600 uppercase tracking-wider"
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
                  className="px-4 py-8 text-center text-xs text-gray-600 font-mono"
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
                      <span className="text-[10px] font-mono text-gray-600">
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-sm text-gray-300">
                        {m.companyName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono text-blue-400">
                        {m.totalScans.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono text-red-400">
                        {m.totalFraudFlags.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-mono font-bold ${fraudAccent}`}
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
  )
}