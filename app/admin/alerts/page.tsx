import { requireAdmin, canWrite } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  Bell,
  CheckCircle2,
  Filter,
  Download,
  MapPin,
  Building2,
  Clock,
} from "lucide-react"

export const revalidate = 30

const SEVERITY_CONFIG = {
  SAFE: {
    dot: "bg-green-500",
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    row: "",
    label: "Safe",
  },
  SUSPICIOUS: {
    dot: "bg-yellow-500",
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    row: "",
    label: "Suspicious",
  },
  HIGH_CONCERN: {
    dot: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    row: "bg-orange-500/5",
    label: "High Concern",
  },
  CRITICAL: {
    dot: "bg-red-500 animate-pulse",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    row: "bg-red-500/5",
    label: "Critical",
  },
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  INVALID_PAIRING: "Invalid Pairing",
  MASS_CLONING: "Mass Cloning",
  GEOGRAPHIC_TELEPORTATION: "Geographic Teleportation",
  SUPPLY_CHAIN_DRIFT: "Supply Chain Drift",
  REPEAT_SCAN_ABUSE: "Repeat Scan Abuse",
  BOT_ACTIVITY: "Bot Activity",
  REFILL_DETECTED: "Refill Detected",
  PRODUCTION_PAIRING_FAIL: "Production Pairing Failure",
  SUSPICIOUS_RETAIL_CLUSTER: "Suspicious Retail Cluster",
  IDENTITY_EXHAUSTION: "Identity Exhaustion",
}

async function getAlerts({
  severity,
  type,
  resolved,
  manufacturerId,
  page,
}: {
  severity?: string
  type?: string
  resolved?: string
  manufacturerId?: string
  page: number
}) {
  const PAGE_SIZE = 25
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    ...(severity && severity !== "ALL"
      ? { severity: severity as any }
      : {}),
    ...(type && type !== "ALL" ? { type: type as any } : {}),
    ...(resolved === "true"
      ? { resolved: true }
      : resolved === "false"
      ? { resolved: false }
      : {}),
    ...(manufacturerId && manufacturerId !== "ALL"
      ? { manufacturerId }
      : {}),
  }

  const [alerts, total] = await Promise.all([
    prisma.alertLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        manufacturer: {
          select: { id: true, companyName: true },
        },
      },
    }),
    prisma.alertLog.count({ where }),
  ])

  return { alerts, total, pages: Math.ceil(total / PAGE_SIZE) }
}

async function getFilterOptions() {
  const manufacturers = await prisma.manufacturer.findMany({
    where: { onboardingStatus: "ACTIVE_PRODUCTION" },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  })

  return { manufacturers }
}

async function getAlertCounts() {
  const [critical, high, suspicious, unresolved] = await Promise.all([
    prisma.alertLog.count({
      where: { severity: "CRITICAL", resolved: false },
    }),
    prisma.alertLog.count({
      where: { severity: "HIGH_CONCERN", resolved: false },
    }),
    prisma.alertLog.count({
      where: { severity: "SUSPICIOUS", resolved: false },
    }),
    prisma.alertLog.count({ where: { resolved: false } }),
  ])

  return { critical, high, suspicious, unresolved }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{
    severity?: string
    type?: string
    resolved?: string
    manufacturerId?: string
    page?: string
  }>
}) {
  const session = await requireAdmin()
  const params = await searchParams

  const page = Math.max(1, parseInt(params.page ?? "1", 10))

  const [{ alerts, total, pages }, filters, counts] = await Promise.all([
    getAlerts({
      severity: params.severity,
      type: params.type,
      resolved: params.resolved,
      manufacturerId: params.manufacturerId,
      page,
    }),
    getFilterOptions(),
    getAlertCounts(),
  ])

  const canResolve = canWrite(session.user.role)

  // Build query string helper for pagination
  const buildQuery = (overrides: Record<string, string>) => {
    const base = {
      ...(params.severity ? { severity: params.severity } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.resolved !== undefined ? { resolved: params.resolved } : {}),
      ...(params.manufacturerId
        ? { manufacturerId: params.manufacturerId }
        : {}),
      ...overrides,
    }
    return new URLSearchParams(base).toString()
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Live Alert Feed
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {counts.unresolved} unresolved · {total} matching current filters
          </p>
        </div>

        {/* Export button */}
        <a
          href="/api/admin/alerts/export"
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs font-mono hover:bg-gray-700 transition-colors border border-gray-700"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </a>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Critical",
            value: counts.critical,
            style: "text-red-400",
            border: "border-red-500/20",
            bg: "bg-red-500/5",
          },
          {
            label: "High Concern",
            value: counts.high,
            style: "text-orange-400",
            border: "border-orange-500/20",
            bg: "bg-orange-500/5",
          },
          {
            label: "Suspicious",
            value: counts.suspicious,
            style: "text-yellow-400",
            border: "border-yellow-500/20",
            bg: "bg-yellow-500/5",
          },
          {
            label: "Total Unresolved",
            value: counts.unresolved,
            style: "text-white",
            border: "border-gray-700",
            bg: "bg-gray-900/40",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`border rounded-xl p-4 ${card.border} ${card.bg}`}
          >
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">
              {card.label}
            </p>
            <p className={`text-2xl font-bold font-mono ${card.style}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form
        method="GET"
        action="/admin/alerts"
        className="flex flex-wrap items-center gap-3"
      >
        <div className="flex items-center gap-1.5 text-xs font-mono text-gray-600">
          <Filter className="w-3.5 h-3.5" />
          Filters:
        </div>

        <select
          name="severity"
          defaultValue={params.severity ?? "ALL"}
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-400 font-mono focus:outline-none focus:border-gray-700"
        >
          <option value="ALL">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH_CONCERN">High Concern</option>
          <option value="SUSPICIOUS">Suspicious</option>
          <option value="SAFE">Safe</option>
        </select>

        <select
          name="type"
          defaultValue={params.type ?? "ALL"}
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-400 font-mono focus:outline-none focus:border-gray-700"
        >
          <option value="ALL">All Types</option>
          {Object.entries(ALERT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          name="resolved"
          defaultValue={params.resolved ?? "false"}
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-400 font-mono focus:outline-none focus:border-gray-700"
        >
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
          <option value="">All</option>
        </select>

        <select
          name="manufacturerId"
          defaultValue={params.manufacturerId ?? "ALL"}
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-400 font-mono focus:outline-none focus:border-gray-700"
        >
          <option value="ALL">All Manufacturers</option>
          {filters.manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.companyName}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs font-mono hover:bg-gray-700 transition-colors"
        >
          Apply
        </button>

        <Link
          href="/admin/alerts"
          className="px-3 py-1.5 text-gray-600 rounded-lg text-xs font-mono hover:text-gray-400 transition-colors"
        >
          Clear
        </Link>
      </form>

      {/* Alert table */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800/60">
              {[
                "Severity",
                "Type",
                "Message",
                "Manufacturer",
                "Location",
                "Confidence",
                "Time",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] font-mono text-gray-600 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/40">
            {alerts.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center"
                >
                  <Bell className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-600 font-mono">
                    No alerts match current filters
                  </p>
                </td>
              </tr>
            ) : (
              alerts.map((alert) => {
                const config = SEVERITY_CONFIG[alert.severity]
                return (
                  <tr
                    key={alert.id}
                    className={`hover:bg-gray-800/30 transition-colors ${config.row}`}
                  >
                    {/* Severity */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`}
                        />
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${config.badge}`}
                        >
                          {config.label}
                        </span>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono text-gray-500 whitespace-nowrap">
                        {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                      </span>
                    </td>

                    {/* Message */}
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-gray-300 line-clamp-2">
                        {alert.message}
                      </p>
                      {alert.detail && (
                        <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-1">
                          {alert.detail}
                        </p>
                      )}
                    </td>

                    {/* Manufacturer */}
                    <td className="px-4 py-3">
                      {alert.manufacturer ? (
                        <Link
                          href={`/admin/manufacturers/${alert.manufacturer.id}`}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-400 transition-colors whitespace-nowrap"
                        >
                          <Building2 className="w-3 h-3" />
                          {alert.manufacturer.companyName}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-600 font-mono">
                          Platform-wide
                        </span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3">
                      {alert.region ? (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {alert.region}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-700">—</span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="px-4 py-3">
                      {alert.confidenceScore ? (
                        <span className="text-xs font-mono text-gray-400">
                          {Math.round(alert.confidenceScore * 100)}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-700">—</span>
                      )}
                    </td>

                    {/* Time */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-gray-600 whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        {timeAgo(alert.createdAt)}
                      </div>
                    </td>

                    {/* Resolve action */}
                    <td className="px-4 py-3">
                      {canResolve && !alert.resolved && (
                        <form
                          action={`/api/admin/alerts/${alert.id}/resolve`}
                          method="POST"
                        >
                          <button
                            type="submit"
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono bg-green-500/10 text-green-400 border border-green-500/20 rounded hover:bg-green-500/20 transition-colors whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Resolve
                          </button>
                        </form>
                      )}
                      {alert.resolved && (
                        <span className="text-[10px] font-mono text-gray-600">
                          Resolved
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800/60">
            <span className="text-[11px] font-mono text-gray-600">
              Page {page} of {pages} · {total} total alerts
            </span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/alerts?${buildQuery({ page: String(page - 1) })}`}
                  className="px-3 py-1 text-xs font-mono bg-gray-800 text-gray-400 rounded hover:bg-gray-700 transition-colors"
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={`/admin/alerts?${buildQuery({ page: String(page + 1) })}`}
                  className="px-3 py-1 text-xs font-mono bg-gray-800 text-gray-400 rounded hover:bg-gray-700 transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}