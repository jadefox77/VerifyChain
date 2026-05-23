import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import {
  Shield,
  Activity,
  AlertTriangle,
  Building2,
  Package,
  Scan,
  TrendingUp,
  Zap,
} from "lucide-react"

export const revalidate = 30

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function getCommandCenterMetrics() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const verificationsToday = await prisma.scanLog.count({
    where: { scannedAt: { gte: today } },
  })

  const activeManufacturers = await prisma.manufacturer.count({
    where: { onboardingStatus: "ACTIVE_PRODUCTION" },
  })

  const fraudAlertsToday = await prisma.alertLog.count({
    where: {
      createdAt: { gte: today },
      resolved: false,
    },
  })

  const criticalAlerts = await prisma.alertLog.count({
    where: {
      severity: { in: ["HIGH_CONCERN", "CRITICAL"] },
      resolved: false,
    },
  })

  const activeBatches = await prisma.batch.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  })

  const openedBottlesToday = await prisma.bottle.count({
    where: {
      status: "OPENED",
      updatedAt: { gte: today },
    },
  })

  const recentAlerts = await prisma.alertLog.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      manufacturer: { select: { companyName: true } },
    },
  })

  return {
    verificationsToday,
    activeManufacturers,
    fraudAlertsToday,
    criticalAlerts,
    activeBatches,
    openedBottlesToday,
    platformFraudRate: 0, // computed by fraud pipeline, not inline
    recentAlerts,
  }
}

// ── Severity config ───────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  sub,
  accent = "blue",
  mono = true,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  accent?: "blue" | "red" | "green" | "orange" | "purple"
  mono?: boolean
}) {
  const colors = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    green: "text-green-400 bg-green-500/10 border-green-500/20",
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  }

  return (
    <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4 hover:border-gray-700/60 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-mono">
          {label}
        </p>
        <div className={`p-1.5 rounded-lg border ${colors[accent]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={`text-2xl font-bold text-white ${mono ? "font-mono" : ""}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && (
        <p className="text-[11px] text-gray-600 mt-1 font-mono">{sub}</p>
      )}
    </div>
  )
}

function AlertFeedItem({
  alert,
}: {
  alert: Awaited<ReturnType<typeof getCommandCenterMetrics>>["recentAlerts"][0]
}) {
  const config = SEVERITY_CONFIG[alert.severity]
  const timeAgo = formatTimeAgo(alert.createdAt)

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800/40 last:border-0">
      <div className="mt-1.5 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${config.badge}`}
          >
            {config.label}
          </span>
          <span className="text-[10px] font-mono text-gray-600 truncate">
            {alert.type.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-xs text-gray-300 truncate">{alert.message}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-600 font-mono">
            {alert.manufacturer?.companyName ?? "Platform-wide"}
          </span>
          <span className="text-[10px] text-gray-700">·</span>
          <span className="text-[10px] text-gray-600 font-mono">{timeAgo}</span>
          {alert.confidenceScore && (
            <>
              <span className="text-[10px] text-gray-700">·</span>
              <span className="text-[10px] text-gray-600 font-mono">
                {Math.round(alert.confidenceScore * 100)}% confidence
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminCommandCenter() {
  await requireAdmin()
  const metrics = await getCommandCenterMetrics()

  const fraudRateDisplay =
    metrics.platformFraudRate > 0
      ? `${metrics.platformFraudRate.toFixed(1)}%`
      : "0.0%"

  const fraudAccent =
    metrics.criticalAlerts > 0
      ? "red"
      : metrics.fraudAlertsToday > 5
      ? "orange"
      : "green"

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">
          Command Center
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-0.5">
          Platform-wide operational intelligence · Auto-refresh every 30s
        </p>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Verifications Today"
          value={metrics.verificationsToday}
          icon={Scan}
          sub="All channels"
          accent="blue"
        />
        <MetricCard
          label="Active Manufacturers"
          value={metrics.activeManufacturers}
          icon={Building2}
          sub="In production"
          accent="green"
        />
        <MetricCard
          label="Fraud Alerts"
          value={metrics.fraudAlertsToday}
          icon={AlertTriangle}
          sub={`${metrics.criticalAlerts} critical unresolved`}
          accent={fraudAccent}
        />
        <MetricCard
          label="Fraud Rate"
          value={fraudRateDisplay}
          icon={TrendingUp}
          sub="Platform avg today"
          accent={metrics.platformFraudRate > 10 ? "red" : "purple"}
        />
        <MetricCard
          label="Active Batches"
          value={metrics.activeBatches}
          icon={Package}
          sub="Last 30 days"
          accent="blue"
        />
        <MetricCard
          label="Bottles Opened Today"
          value={metrics.openedBottlesToday}
          icon={Zap}
          sub="First-open events"
          accent="green"
        />
      </div>

      {/* Main content — alert feed + placeholder for charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live alert feed */}
        <div className="lg:col-span-1 bg-gray-900/60 border border-gray-800/60 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <h2 className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                Live Alert Feed
              </h2>
            </div>
            <a
              href="/admin/alerts"
              className="text-[10px] text-blue-400 hover:text-blue-300 font-mono transition-colors"
            >
              View all →
            </a>
          </div>

          <div className="px-4 divide-y divide-gray-800/40">
            {metrics.recentAlerts.length === 0 ? (
              <div className="py-8 text-center">
                <Shield className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500 font-mono">
                  No active alerts
                </p>
              </div>
            ) : (
              metrics.recentAlerts.map((alert) => (
                <AlertFeedItem key={alert.id} alert={alert} />
              ))
            )}
          </div>
        </div>

        {/* Verification volume placeholder — wire up with chart library in Phase 4 */}
        <div className="lg:col-span-2 bg-gray-900/60 border border-gray-800/60 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <h2 className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                Verification Volume — Last 7 Days
              </h2>
            </div>
          </div>
          <div className="px-4 py-3">
            <VerificationSparklines />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Inline sparklines (pure CSS, no chart lib dependency yet) ─────────────────

async function VerificationSparklines() {
  const counts: number[] = []
  const fraudCounts: number[] = []

  for (let i = 0; i < 7; i++) {
    const day = new Date()
    day.setDate(day.getDate() - (6 - i))
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)

    const total = await prisma.scanLog.count({
      where: { scannedAt: { gte: day, lt: next } },
    })
    const fraud = await prisma.scanLog.count({
      where: { scannedAt: { gte: day, lt: next }, fraudFlag: true },
    })

    counts.push(total)
    fraudCounts.push(fraud)
  }

  const max = Math.max(...counts, 1)

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const todayIndex = new Date().getDay()
  const orderedLabels = Array.from(
    { length: 7 },
    (_, i) => dayLabels[(todayIndex - 6 + i + 7) % 7]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 h-32">
        {counts.map((count, i) => {
          const heightPct = Math.max((count / max) * 100, 2)
          const fraudPct =
            count > 0 ? (fraudCounts[i] / count) * heightPct : 0

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end h-24 gap-0.5">
                <div
                  className="w-full bg-red-500/40 rounded-t-sm transition-all"
                  style={{ height: `${fraudPct}%` }}
                />
                <div
                  className="w-full bg-blue-500/40 rounded-t-sm transition-all"
                  style={{ height: `${heightPct - fraudPct}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-gray-600">
                {orderedLabels[i]}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/40" />
            <span className="text-[10px] font-mono text-gray-500">Genuine</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-500/40" />
            <span className="text-[10px] font-mono text-gray-500">Fraudulent</span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-gray-600">
          {counts.reduce((a, b) => a + b, 0).toLocaleString()} total this week
        </span>
      </div>
    </div>
  )
}