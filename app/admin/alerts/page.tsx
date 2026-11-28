import { requireAdmin, canResolveAlerts, canRestoreProducts } from "@/lib/admin-auth"
import { REASON_MAX, REASON_MIN, RESTORABLE_ALERT_TYPES } from "@/lib/restore"
import { prisma } from "@/lib/prisma"
import type { Metadata } from "next"
import Link from "next/link"
import type { AlertSeverity, AlertType } from "@prisma/client"
import { ALERT_TYPE_LABELS } from "@/lib/alerts"
import { formatDate, timeAgo } from "@/lib/format"
import {
  Bell,
  CheckCircle2,
  Filter,
  Download,
  MapPin,
  Building2,
  Clock,
} from "lucide-react"

export const metadata: Metadata = { title: "Alerts" }

export const revalidate = 30

const SEVERITY_CONFIG = {
  SAFE: {
    dot: "bg-green-500",
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    row: "",
    label: "Informational",
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
    label: "High concern",
  },
  CRITICAL: {
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    row: "bg-red-500/5",
    label: "Critical",
  },
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
      ? { severity: severity as AlertSeverity }
      : {}),
    ...(type && type !== "ALL" ? { type: type as AlertType } : {}),
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

  // resolvedBy holds a user id; look up names to show who resolved each alert.
  const resolverIds = [...new Set(alerts.map((a) => a.resolvedBy).filter((v): v is string => !!v))]
  const resolvers = resolverIds.length
    ? await prisma.user.findMany({
        where: { id: { in: resolverIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const resolverNames = new Map(resolvers.map((u) => [u.id, u.name ?? u.email ?? "Unknown user"]))

  return { alerts, total, pages: Math.ceil(total / PAGE_SIZE), resolverNames }
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

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{
    severity?: string
    type?: string
    resolved?: string
    manufacturerId?: string
    page?: string
    restored?: string
    restore_error?: string
  }>
}) {
  const session = await requireAdmin()
  const params = await searchParams

  const page = Math.max(1, parseInt(params.page ?? "1", 10))

  const [{ alerts, total, pages, resolverNames }, filters, counts] = await Promise.all([
    getAlerts({
      severity: params.severity,
      type: params.type,
      // Default to open alerts, matching the filter's default option
      resolved: params.resolved ?? "false",
      manufacturerId: params.manufacturerId,
      page,
    }),
    getFilterOptions(),
    getAlertCounts(),
  ])

  const canResolve = canResolveAlerts(session.user.role)
  const canRestore = canRestoreProducts(session.user.role)
  const restorable = (type: string) => (RESTORABLE_ALERT_TYPES as readonly string[]).includes(type)

  const restoredCount = params.restored !== undefined ? parseInt(params.restored, 10) : null
  const RESTORE_ERRORS: Record<string, string> = {
    bad_reason: `Write a reason of at least ${REASON_MIN} characters to restore products.`,
    not_found: "That alert no longer exists.",
    wrong_type: "Only cap mismatch and outside-target-state alerts can restore products.",
    nothing_to_restore: "Nothing to restore: the products for this alert are not flagged.",
  }
  const restoreError = params.restore_error ? (RESTORE_ERRORS[params.restore_error] ?? "Restore failed.") : null

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
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Alerts
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {counts.unresolved} open · {total} matching these filters
          </p>
        </div>

        {/* Export button */}
        <a
          href="/api/admin/alerts/export"
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition-colors border border-gray-700"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </a>
      </div>

      {restoredCount !== null && Number.isFinite(restoredCount) && (
        <p role="status" className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-300">
          {restoredCount === 0
            ? "Alert resolved. No products were flagged, so none needed restoring."
            : `Restored ${restoredCount} product${restoredCount === 1 ? "" : "s"} and resolved the alert. The reason is in the audit log.`}
        </p>
      )}
      {restoreError && (
        <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {restoreError}
        </p>
      )}

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
            label: "High concern",
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
            label: "All open",
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
            <p className="text-xs text-gray-500 mb-1 font-medium">
              {card.label}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${card.style}`}>
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
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </div>

        <select
          name="severity"
          defaultValue={params.severity ?? "ALL"}
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-400 focus:outline-none focus:border-gray-700"
        >
          <option value="ALL">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH_CONCERN">High concern</option>
          <option value="SUSPICIOUS">Suspicious</option>
          <option value="SAFE">Informational</option>
        </select>

        <select
          name="type"
          defaultValue={params.type ?? "ALL"}
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-400 focus:outline-none focus:border-gray-700"
        >
          <option value="ALL">All types</option>
          {Object.entries(ALERT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          name="resolved"
          defaultValue={params.resolved ?? "false"}
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-400 focus:outline-none focus:border-gray-700"
        >
          <option value="false">Open</option>
          <option value="true">Resolved</option>
          <option value="">All</option>
        </select>

        <select
          name="manufacturerId"
          defaultValue={params.manufacturerId ?? "ALL"}
          className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-400 focus:outline-none focus:border-gray-700"
        >
          <option value="ALL">All manufacturers</option>
          {filters.manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.companyName}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition-colors"
        >
          Apply
        </button>

        <Link
          href="/admin/alerts"
          className="px-3 py-1.5 text-gray-400 rounded-lg text-xs hover:text-gray-200 transition-colors"
        >
          Clear
        </Link>
      </form>

      {/* Alert table */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="table-scroll">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-800/60">
              {[
                "Severity",
                "Type",
                "Message",
                "Manufacturer",
                "Location",
                "Confidence",
                "Raised",
                "Action",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs text-gray-400 font-medium"
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
                  <Bell className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">
                    No alerts match these filters
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
                          className={`text-xs px-1.5 py-0.5 rounded border whitespace-nowrap ${config.badge}`}
                        >
                          {config.label}
                        </span>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                      </span>
                    </td>

                    {/* Message */}
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-gray-300 line-clamp-2">
                        {alert.message}
                      </p>
                      {alert.detail && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
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
                        <span className="text-xs text-gray-400">
                          All manufacturers
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
                        <span className="text-xs text-gray-500">None</span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="px-4 py-3">
                      {alert.confidenceScore ? (
                        <span className="text-xs text-gray-400">
                          {Math.round(alert.confidenceScore * 100)}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">None</span>
                      )}
                    </td>

                    {/* Time */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
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
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded hover:bg-green-500/20 transition-colors whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Resolve
                          </button>
                        </form>
                      )}
                      {canRestore && restorable(alert.type) && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer whitespace-nowrap text-blue-400 hover:text-blue-300">
                            Restore products
                          </summary>
                          <form
                            action={`/api/admin/alerts/${alert.id}/restore`}
                            method="POST"
                            className="mt-2 w-56 space-y-2"
                          >
                            <p className="text-gray-400">
                              Puts the flagged cap and bottle back to sealed or opened, and resolves the alert.
                            </p>
                            <label htmlFor={`reason-${alert.id}`} className="sr-only">
                              Reason
                            </label>
                            <textarea
                              id={`reason-${alert.id}`}
                              name="reason"
                              required
                              minLength={REASON_MIN}
                              maxLength={REASON_MAX}
                              rows={2}
                              placeholder="Reason, for the audit log"
                              className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200 placeholder:text-gray-500"
                            />
                            <button
                              type="submit"
                              className="px-2 py-1 text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-colors"
                            >
                              Restore
                            </button>
                          </form>
                        </details>
                      )}
                      {alert.resolved && (
                        <div className="text-xs text-gray-400">
                          <p className="text-gray-300">
                            Resolved by{" "}
                            {(alert.resolvedBy && resolverNames.get(alert.resolvedBy)) ?? "an unknown user"}
                          </p>
                          {alert.resolvedAt && (
                            <p className="mt-0.5 whitespace-nowrap" title={formatDate(alert.resolvedAt, true)}>
                              {timeAgo(alert.resolvedAt)}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800/60">
            <span className="text-[11px] text-gray-400">
              Page {page} of {pages} · {total} total alerts
            </span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/alerts?${buildQuery({ page: String(page - 1) })}`}
                  className="px-3 py-1 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700 transition-colors"
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={`/admin/alerts?${buildQuery({ page: String(page + 1) })}`}
                  className="px-3 py-1 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700 transition-colors"
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