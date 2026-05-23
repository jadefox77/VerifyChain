import { requireFraudAccess } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { FraudMapWrapper } from "@/components/admin/fraud-map-wrapper"
import {
  ShieldAlert,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Zap,
  Eye,
  Bot,
  GitFork,
} from "lucide-react"

export const revalidate = 30


// ── Data fetchers ─────────────────────────────────────────────────────────────

async function getFraudSummary() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const totalAlerts = await prisma.alertLog.count({
    where: { resolved: false },
  })

  const criticalAlerts = await prisma.alertLog.count({
    where: { severity: "CRITICAL", resolved: false },
  })

  const highConcernAlerts = await prisma.alertLog.count({
    where: { severity: "HIGH_CONCERN", resolved: false },
  })

  const suspiciousAlerts = await prisma.alertLog.count({
    where: { severity: "SUSPICIOUS", resolved: false },
  })

  const resolvedToday = await prisma.alertLog.count({
    where: {
      resolved: true,
      resolvedAt: { gte: today },
    },
  })

  const alertsByType = await prisma.alertLog.groupBy({
    by: ["type"],
    _count: true,
    where: { resolved: false },
    orderBy: { _count: { type: "desc" } },
  })

  const manufacturerFraudRates = await prisma.manufacturer.findMany({
    where: { onboardingStatus: "ACTIVE_PRODUCTION" },
    select: {
      id: true,
      companyName: true,
      fraudRateCached: true,
      totalBottlesGenerated: true,
      totalFraudFlags: true,
      _count: { select: { alertLogs: true } },
    },
    orderBy: { fraudRateCached: "desc" },
    take: 10,
  })

  const recentCritical = await prisma.alertLog.findMany({
    where: {
      severity: { in: ["CRITICAL", "HIGH_CONCERN"] },
      resolved: false,
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      manufacturer: { select: { companyName: true } },
    },
  })

  return {
    totalAlerts,
    criticalAlerts,
    highConcernAlerts,
    suspiciousAlerts,
    resolvedToday,
    alertsByType,
    manufacturerFraudRates,
    recentCritical,
  }
}

async function getScanPoints() {
  // Get recent scan points with location data for the map
  return prisma.scanLog.findMany({
    where: {
      lat: { not: null },
      lng: { not: null },
      scannedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      lat: true,
      lng: true,
      fraudFlag: true,
      region: true,
    },
    take: 1000, // cap for map performance
    orderBy: { scannedAt: "desc" },
  })
}

async function getRegionalBreakdown() {
  const result = await prisma.scanLog.groupBy({
    by: ["region"],
    _count: true,
    where: {
      region: { not: null },
      scannedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { _count: { region: "desc" } },
    take: 10,
  })

  const fraudByRegion = await prisma.scanLog.groupBy({
    by: ["region"],
    _count: true,
    where: {
      region: { not: null },
      fraudFlag: true,
      scannedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  })

  return result.map((r) => ({
    region: r.region!,
    total: r._count,
    fraud:
      fraudByRegion.find((f) => f.region === r.region)?._count ?? 0,
    rate:
      r._count > 0
        ? ((fraudByRegion.find((f) => f.region === r.region)?._count ?? 0) /
            r._count) *
          100
        : 0,
  }))
}

// ── Alert type config ─────────────────────────────────────────────────────────

const ALERT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  INVALID_PAIRING: {
    label: "Invalid Pairing",
    icon: GitFork,
    color: "text-red-400",
  },
  MASS_CLONING: {
    label: "Mass Cloning",
    icon: Eye,
    color: "text-red-400",
  },
  GEOGRAPHIC_TELEPORTATION: {
    label: "Teleportation",
    icon: MapPin,
    color: "text-orange-400",
  },
  SUPPLY_CHAIN_DRIFT: {
    label: "Supply Chain Drift",
    icon: TrendingUp,
    color: "text-orange-400",
  },
  REPEAT_SCAN_ABUSE: {
    label: "Repeat Scan Abuse",
    icon: Zap,
    color: "text-yellow-400",
  },
  BOT_ACTIVITY: {
    label: "Bot Activity",
    icon: Bot,
    color: "text-purple-400",
  },
  REFILL_DETECTED: {
    label: "Refill Detected",
    icon: AlertTriangle,
    color: "text-red-400",
  },
  PRODUCTION_PAIRING_FAIL: {
    label: "Pairing Failure",
    icon: GitFork,
    color: "text-yellow-400",
  },
  SUSPICIOUS_RETAIL_CLUSTER: {
    label: "Retail Cluster",
    icon: MapPin,
    color: "text-orange-400",
  },
  IDENTITY_EXHAUSTION: {
    label: "Identity Exhaustion",
    icon: Eye,
    color: "text-purple-400",
  },
}

const SEVERITY_CONFIG = {
  SAFE: {
    dot: "bg-green-500",
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    label: "Safe",
  },
  SUSPICIOUS: {
    dot: "bg-yellow-500",
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    label: "Suspicious",
  },
  HIGH_CONCERN: {
    dot: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    label: "High Concern",
  },
  CRITICAL: {
    dot: "bg-red-500 animate-pulse",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    label: "Critical",
  },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FraudIntelligencePage() {
  await requireFraudAccess()

const summary = await getFraudSummary()
const scanPoints = await getScanPoints()
const regional = await getRegionalBreakdown()

  const mapPoints = scanPoints
    .filter((p) => p.lat !== null && p.lng !== null)
    .map((p) => ({
      lat: p.lat!,
      lng: p.lng!,
      fraudFlag: p.fraudFlag,
      region: p.region,
    }))

  const fraudPoints = mapPoints.filter((p) => p.fraudFlag)
  const genuinePoints = mapPoints.filter((p) => !p.fraudFlag)

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">
          Fraud Intelligence Center
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-0.5">
          Platform-wide threat monitoring · Last 30 days
        </p>
      </div>

      {/* Threat level summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Critical Threats",
            value: summary.criticalAlerts,
            style: "text-red-400",
            border: "border-red-500/20",
            bg: "bg-red-500/5",
            dot: "bg-red-500 animate-pulse",
          },
          {
            label: "High Concern",
            value: summary.highConcernAlerts,
            style: "text-orange-400",
            border: "border-orange-500/20",
            bg: "bg-orange-500/5",
            dot: "bg-orange-500",
          },
          {
            label: "Suspicious",
            value: summary.suspiciousAlerts,
            style: "text-yellow-400",
            border: "border-yellow-500/20",
            bg: "bg-yellow-500/5",
            dot: "bg-yellow-500",
          },
          {
            label: "Resolved Today",
            value: summary.resolvedToday,
            style: "text-green-400",
            border: "border-green-500/20",
            bg: "bg-green-500/5",
            dot: "bg-green-500",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`border rounded-xl p-4 ${card.border} ${card.bg}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-1.5 h-1.5 rounded-full ${card.dot}`} />
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                {card.label}
              </p>
            </div>
            <p className={`text-3xl font-bold font-mono ${card.style}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Map + alert breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <h2 className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                Geographic Fraud Intelligence
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-mono text-gray-500">
                  Fraud ({fraudPoints.length})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 opacity-60" />
                <span className="text-[10px] font-mono text-gray-500">
                  Genuine ({genuinePoints.length})
                </span>
              </div>
            </div>
          </div>
          <div className="p-3" style={{ height: "420px" }}>
           <FraudMapWrapper scanPoints={mapPoints} />
          </div>
        </div>

        {/* Alert type breakdown */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-4">
            Alert Categories
          </h2>
          <div className="space-y-2">
            {summary.alertsByType.length === 0 ? (
              <p className="text-xs text-gray-600 font-mono">
                No active alerts
              </p>
            ) : (
              summary.alertsByType.map((a) => {
                const config =
                  ALERT_TYPE_CONFIG[a.type] ?? {
                    label: a.type,
                    icon: ShieldAlert,
                    color: "text-gray-400",
                  }
                const Icon = config.icon
                const maxCount = summary.alertsByType[0]?._count ?? 1
                const widthPct = Math.round((a._count / maxCount) * 100)

                return (
                  <div key={a.type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3 h-3 ${config.color}`} />
                        <span className="text-[11px] text-gray-400">
                          {config.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">
                        {a._count}
                      </span>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500/50 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Critical alerts + manufacturer fraud rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent critical alerts */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <h2 className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                Active Critical & High Concern
              </h2>
            </div>
          </div>
          <div className="divide-y divide-gray-800/40">
            {summary.recentCritical.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <ShieldAlert className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-xs text-gray-600 font-mono">
                  No critical alerts
                </p>
              </div>
            ) : (
              summary.recentCritical.map((alert) => {
                const config = SEVERITY_CONFIG[alert.severity]
                return (
                  <div key={alert.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${config.dot}`}
                      />
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${config.badge}`}
                      >
                        {config.label}
                      </span>
                      <span className="text-[10px] font-mono text-gray-600">
                        {alert.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mb-1">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-gray-600">
                        {alert.manufacturer?.companyName ?? "Platform-wide"}
                      </span>
                      {alert.confidenceScore && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span className="text-[10px] font-mono text-gray-600">
                            {Math.round(alert.confidenceScore * 100)}% confidence
                          </span>
                        </>
                      )}
                      {alert.region && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span className="text-[10px] font-mono text-gray-600">
                            {alert.region}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Manufacturer fraud rankings */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-800/60">
            <h2 className="text-xs font-mono text-gray-300 uppercase tracking-wider">
              Manufacturer Fraud Rankings
            </h2>
          </div>
          <div className="divide-y divide-gray-800/40">
            {summary.manufacturerFraudRates.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-gray-600 font-mono">
                  No active manufacturers
                </p>
              </div>
            ) : (
              summary.manufacturerFraudRates.map((m, i) => {
                const fraudAccent =
                  m.fraudRateCached > 15
                    ? "text-red-400"
                    : m.fraudRateCached > 5
                    ? "text-orange-400"
                    : "text-green-400"

                const barColor =
                  m.fraudRateCached > 15
                    ? "bg-red-500/50"
                    : m.fraudRateCached > 5
                    ? "bg-orange-500/50"
                    : "bg-green-500/50"

                const maxRate =
                  summary.manufacturerFraudRates[0]?.fraudRateCached ?? 1
                const widthPct =
                  maxRate > 0
                    ? Math.round((m.fraudRateCached / maxRate) * 100)
                    : 0

                return (
                  <div key={m.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-gray-700 w-4">
                          {i + 1}
                        </span>
                        <span className="text-xs text-gray-300">
                          {m.companyName}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold ${fraudAccent}`}
                      >
                        {m.fraudRateCached.toFixed(1)}%
                      </span>
                    </div>
                    <div className="ml-6 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="ml-6 flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-mono text-gray-700">
                        {m.totalFraudFlags.toLocaleString()} flags ·{" "}
                        {m.totalBottlesGenerated.toLocaleString()} bottles ·{" "}
                        {m._count.alertLogs} alerts
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Regional breakdown table */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/60">
          <h2 className="text-xs font-mono text-gray-300 uppercase tracking-wider">
            Regional Fraud Breakdown — Last 30 Days
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800/40">
              {["Region", "Total Scans", "Fraud Events", "Fraud Rate", "Risk"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[10px] font-mono text-gray-600 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/40">
            {regional.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-xs text-gray-600 font-mono"
                >
                  No regional data — scan logs need location data
                </td>
              </tr>
            ) : (
              regional.map((r) => {
                const riskLevel =
                  r.rate > 15
                    ? { label: "High", style: "text-red-400" }
                    : r.rate > 5
                    ? { label: "Medium", style: "text-orange-400" }
                    : { label: "Low", style: "text-green-400" }

                return (
                  <tr
                    key={r.region}
                    className="hover:bg-gray-800/20 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-gray-600" />
                        <span className="text-sm text-gray-300">
                          {r.region}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono text-gray-400">
                        {r.total.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono text-red-400">
                        {r.fraud.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-mono font-bold ${riskLevel.style}`}
                      >
                        {r.rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] font-mono ${riskLevel.style}`}
                      >
                        {riskLevel.label}
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
  )
}