import { requireRegulatoryAccess } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import {
  ScrollText,
  ShieldAlert,
  Building2,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
} from "lucide-react"

export const revalidate = 30

async function getRegulatoryData() {
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const last90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  // Batch 1
  const [totalManufacturers, activeManufacturers, pendingManufacturers] =
    await Promise.all([
      prisma.manufacturer.count(),
      prisma.manufacturer.count({
        where: { onboardingStatus: "ACTIVE_PRODUCTION" },
      }),
      prisma.manufacturer.count({
        where: {
          onboardingStatus: {
            in: [
              "PENDING_REVIEW",
              "COMPLIANCE_VERIFICATION",
              "TECHNICAL_INTEGRATION",
              "PILOT_APPROVAL",
            ],
          },
        },
      }),
    ])

  // Batch 2
  const [suspendedManufacturers, totalBottlesAuthenticated, totalFraudEvents] =
    await Promise.all([
      prisma.manufacturer.count({
        where: { onboardingStatus: "SUSPENDED" },
      }),
      prisma.bottle.count({
        where: { status: "OPENED" },
      }),
      prisma.alertLog.count({
        where: {
          createdAt: { gte: last30Days },
          severity: { in: ["HIGH_CONCERN", "CRITICAL"] },
        },
      }),
    ])

  // Batch 3
  const [criticalIncidents, fraudByRegion, suspiciousBatches] =
    await Promise.all([
      prisma.alertLog.count({
        where: {
          createdAt: { gte: last90Days },
          severity: "CRITICAL",
        },
      }),
      prisma.scanLog.groupBy({
        by: ["region"],
        _count: true,
        where: {
          fraudFlag: true,
          region: { not: null },
          scannedAt: { gte: last30Days },
        },
        orderBy: { _count: { region: "desc" } },
        take: 10,
      }),
      prisma.batch.findMany({
        where: {
          bottles: { some: { status: "FLAGGED" } },
        },
        select: {
          id: true,
          batchCode: true,
          createdAt: true,
          targetRegion: true,
          bottleCount: true,
          manufacturer: {
            select: {
              id: true,
              companyName: true,
              rcNumber: true,
              nafdacNumbers: true,
            },
          },
          product: { select: { name: true } },
          _count: { select: { bottles: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ])

  // Batch 4
  const [manufacturerCompliance, recentIncidents] = await Promise.all([
    prisma.manufacturer.findMany({
      where: { onboardingStatus: "ACTIVE_PRODUCTION" },
      select: {
        id: true,
        companyName: true,
        rcNumber: true,
        nafdacNumbers: true,
        distributionRegions: true,
        fraudRateCached: true,
        totalBottlesGenerated: true,
        subscriptionStatus: true,
        createdAt: true,
      },
      orderBy: { fraudRateCached: "desc" },
    }),
    prisma.alertLog.findMany({
      where: {
        severity: { in: ["CRITICAL", "HIGH_CONCERN"] },
        createdAt: { gte: last90Days },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        manufacturer: {
          select: { companyName: true, rcNumber: true },
        },
      },
    }),
  ])

  // Flagged counts per batch — keep sequential, small loop
  const suspiciousBatchesWithFlagCounts = []
  for (const batch of suspiciousBatches) {
    const flaggedCount = await prisma.bottle.count({
      where: { batchId: batch.id, status: "FLAGGED" },
    })
    suspiciousBatchesWithFlagCounts.push({ ...batch, flaggedCount })
  }

  // Monthly trend — sequential loop, 6 months
  const monthlyFraudTrend = []
  for (let i = 0; i < 6; i++) {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    monthStart.setMonth(monthStart.getMonth() - (5 - i))
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const [incidents, scans] = await Promise.all([
      prisma.alertLog.count({
        where: {
          createdAt: { gte: monthStart, lt: monthEnd },
          severity: { in: ["HIGH_CONCERN", "CRITICAL"] },
        },
      }),
      prisma.scanLog.count({
        where: { scannedAt: { gte: monthStart, lt: monthEnd } },
      }),
    ])

    monthlyFraudTrend.push({
      month: monthStart.toLocaleDateString("en-NG", {
        month: "short",
        year: "numeric",
      }),
      incidents,
      scans,
    })
  }

  return {
    totalManufacturers,
    activeManufacturers,
    pendingManufacturers,
    suspendedManufacturers,
    totalBottlesAuthenticated,
    totalFraudEvents,
    criticalIncidents,
    fraudByRegion,
    suspiciousBatches: suspiciousBatchesWithFlagCounts,
    manufacturerCompliance,
    recentIncidents,
    monthlyFraudTrend,
  }
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    label: "Critical",
  },
  HIGH_CONCERN: {
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    label: "High Concern",
  },
  SUSPICIOUS: {
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    label: "Suspicious",
  },
  SAFE: {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    label: "Safe",
  },
}

export default async function RegulatoryPage() {
  await requireRegulatoryAccess()
  const data = await getRegulatoryData()

  const maxRegionFraud = data.fraudByRegion[0]?._count ?? 1
  const maxIncidents = Math.max(
    ...data.monthlyFraudTrend.map((m) => m.incidents),
    1
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ScrollText className="w-4 h-4 text-teal-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              Regulatory Intelligence View
            </h1>
          </div>
          <p className="text-xs text-gray-500">
            Read-only · NAFDAC / SON observer access ·{" "}
            {new Date().toLocaleDateString("en-NG", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Export */}
        <a
          href="/api/admin/regulatory/export"
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition-colors border border-gray-700"
        >
          <Download className="w-3.5 h-3.5" />
          Export Report
        </a>
      </div>

      {/* Read-only notice */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/5 border border-teal-500/20 rounded-lg">
        <ShieldAlert className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        <p className="text-xs text-teal-400">
          This view is read-only. Data reflects live platform intelligence.
          All manufacturer activity is monitored and logged.
        </p>
      </div>

      {/* Platform overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Registered Manufacturers",
            value: data.totalManufacturers,
            sub: `${data.activeManufacturers} active production`,
            accent: "text-white",
          },
          {
            label: "Bottles Authenticated",
            value: data.totalBottlesAuthenticated.toLocaleString(),
            sub: "First-open confirmed",
            accent: "text-green-400",
          },
          {
            label: "Fraud events, 30 days",
            value: data.totalFraudEvents,
            sub: "High concern + critical",
            accent:
              data.totalFraudEvents > 50 ? "text-red-400" : "text-orange-400",
          },
          {
            label: "Critical incidents, 90 days",
            value: data.criticalIncidents,
            sub: "Requires investigation",
            accent:
              data.criticalIncidents > 10 ? "text-red-400" : "text-orange-400",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4"
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

      {/* Manufacturer status summary */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
        <h2 className="text-xs text-gray-400 mb-4 font-medium">
          Manufacturer Registry Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Active Production",
              value: data.activeManufacturers,
              icon: CheckCircle2,
              color: "text-green-400",
            },
            {
              label: "In Onboarding",
              value: data.pendingManufacturers,
              icon: AlertTriangle,
              color: "text-yellow-400",
            },
            {
              label: "Suspended",
              value: data.suspendedManufacturers,
              icon: XCircle,
              color: "text-red-400",
            },
            {
              label: "Total Registered",
              value: data.totalManufacturers,
              icon: Building2,
              color: "text-gray-400",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 p-3 bg-gray-800/40 rounded-lg border border-gray-800/40"
            >
              <item.icon className={`w-4 h-4 ${item.color} shrink-0`} />
              <div>
                <p className="text-xs text-gray-400">
                  {item.label}
                </p>
                <p className={`text-lg font-bold tabular-nums ${item.color}`}>
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly fraud trend + regional fraud */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 6-month fraud trend */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs text-gray-400 mb-4 font-medium">
            Fraud incidents, last 6 months
          </h2>
          <div className="flex items-end gap-2 h-32">
            {data.monthlyFraudTrend.map(({ month, incidents }, i) => {
              const heightPct = Math.max(
                (incidents / maxIncidents) * 100,
                incidents > 0 ? 4 : 0
              )
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  {incidents > 0 && (
                    <span className="text-[11px] text-gray-400">
                      {incidents}
                    </span>
                  )}
                  <div className="w-full flex flex-col justify-end h-24">
                    <div
                      className="w-full bg-red-500/40 rounded-t-sm hover:bg-red-500/60 transition-colors"
                      style={{ height: `${heightPct}%` }}
                      title={`${incidents} incidents`}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 text-center">
                    {month.split(" ")[0]}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800/40">
            <span className="text-xs text-gray-400">
              Total incidents:{" "}
              {data.monthlyFraudTrend
                .reduce((s, m) => s + m.incidents, 0)
                .toLocaleString()}{" "}
              over 6 months
            </span>
          </div>
        </div>

        {/* Fraud by region */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs text-gray-400 mb-4 font-medium">
            Fraud events by state, last 30 days
          </h2>
          <div className="space-y-2.5">
            {data.fraudByRegion.length === 0 ? (
              <p className="text-xs text-gray-400">
                No fraud events with a location yet. Location is only recorded when the shopper shares it.
              </p>
            ) : (
              data.fraudByRegion.map((r, i) => {
                const pct = Math.round((r._count / maxRegionFraud) * 100)
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
                      <span className="text-xs text-red-400">
                        {r._count.toLocaleString()} events
                      </span>
                    </div>
                    <div className="ml-10 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500/40 rounded-full"
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

      {/* Suspicious batches */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/60 flex items-center justify-between">
          <h2 className="text-xs text-gray-400 font-medium">
            Suspicious Batch Reports
          </h2>
          <span className="text-xs text-gray-400">
            {data.suspiciousBatches.length} batch
            {data.suspiciousBatches.length !== 1 ? "es" : ""} flagged
          </span>
        </div>
        <div className="table-scroll">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-800/40">
              {[
                "Batch Code",
                "Manufacturer",
                "RC Number",
                "NAFDAC Reg",
                "Product",
                "Region",
                "Total Bottles",
                "Flagged",
                "Date",
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
            {data.suspiciousBatches.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-xs text-gray-400"
                >
                  No suspicious batches detected
                </td>
              </tr>
            ) : (
              data.suspiciousBatches.map((batch) => {
                const flagPct =
                  batch.bottleCount > 0
                    ? (
                        (batch.flaggedCount / batch.bottleCount) *
                        100
                      ).toFixed(1)
                    : "0.0"

                return (
                  <tr
                    key={batch.id}
                    className="hover:bg-gray-800/20 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-gray-300">
                        {batch.batchCode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-300">
                        {batch.manufacturer.companyName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-gray-500">
                        {batch.manufacturer.rcNumber ?? "Not provided"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500">
                        {batch.manufacturer.nafdacNumbers ?? "Not provided"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-400">
                        {batch.product?.name ?? "No product"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500">
                        {batch.targetRegion ?? "Any"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-400">
                        {batch.bottleCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div>
                        <span className="text-xs text-red-400">
                          {batch.flaggedCount.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-gray-400 ml-1">
                          ({flagPct}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-400">
                        {new Date(batch.createdAt).toLocaleDateString(
                          "en-NG",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Manufacturer compliance table */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/60">
          <h2 className="text-xs text-gray-400 font-medium">
            Manufacturer Compliance Monitor
          </h2>
        </div>
        <div className="table-scroll">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-800/40">
              {[
                "Company",
                "RC Number",
                "NAFDAC Numbers",
                "Distribution Regions",
                "Fraud Rate",
                "Total Bottles",
                "Account Status",
                "Registered",
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
            {data.manufacturerCompliance.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-xs text-gray-400"
                >
                  No active manufacturers
                </td>
              </tr>
            ) : (
              data.manufacturerCompliance.map((m) => {
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
                      <span className="text-sm text-gray-300">
                        {m.companyName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-gray-500">
                        {m.rcNumber ?? "Not provided"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 max-w-[140px] truncate block">
                        {m.nafdacNumbers ?? "Not provided"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 max-w-[120px] truncate block">
                        {m.distributionRegions ?? "Not specified"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-bold ${fraudAccent}`}
                      >
                        {m.fraudRateCached.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-400">
                        {m.totalBottlesGenerated.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          m.subscriptionStatus === "ACTIVE"
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : m.subscriptionStatus === "SUSPENDED"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        }`}
                      >
                        {m.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-400">
                        {new Date(m.createdAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Recent incidents */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl">
        <div className="px-4 py-3 border-b border-gray-800/60">
          <h2 className="text-xs text-gray-400 font-medium">
            Counterfeit incidents, last 90 days
          </h2>
        </div>
        <div className="divide-y divide-gray-800/40">
          {data.recentIncidents.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-xs text-gray-400">
                No critical or high concern incidents in the last 90 days
              </p>
            </div>
          ) : (
            data.recentIncidents.map((incident) => {
              const config = SEVERITY_CONFIG[incident.severity]
              return (
                <div
                  key={incident.id}
                  className="px-4 py-3 flex items-start gap-3"
                >
                  <div className="shrink-0 mt-0.5">
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded border ${config.badge}`}
                    >
                      {config.label}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 mb-0.5">
                      {incident.message}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {incident.manufacturer?.companyName ?? "Platform-wide"}
                      </span>
                      {incident.manufacturer?.rcNumber && (
                        <>
                          <span className="text-gray-500">·</span>
                          <span className="text-xs text-gray-400">
                            RC: {incident.manufacturer.rcNumber}
                          </span>
                        </>
                      )}
                      {incident.region && (
                        <>
                          <span className="text-gray-500">·</span>
                          <span className="text-xs text-gray-400">
                            {incident.region}
                          </span>
                        </>
                      )}
                      {incident.confidenceScore && (
                        <>
                          <span className="text-gray-500">·</span>
                          <span className="text-xs text-gray-400">
                            {Math.round(incident.confidenceScore * 100)}%
                            confidence
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {new Date(incident.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}