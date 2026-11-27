import type { Metadata } from "next"
import Link from "next/link"
import { Bell, Building2, Package, ScanLine, ShieldCheck, ShieldAlert, TrendingUp } from "lucide-react"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { lastLagosDays, startOfLagosDay } from "@/lib/lagos-time"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { card, cardHeader, cardTitle } from "@/lib/ui"
import { timeAgo } from "@/lib/format"
import { SEVERITY, ALERT_TYPE_LABELS } from "@/lib/alerts"

export const metadata: Metadata = { title: "Overview" }

export const revalidate = 30

const DAY = 24 * 60 * 60 * 1000

async function getOverview() {
  const today = startOfLagosDay()

  const [
    scansToday,
    flaggedScansToday,
    activeManufacturers,
    pendingReview,
    alertsToday,
    highPriorityOpen,
    batchesLast30,
    openedToday,
    recentAlerts,
  ] = await Promise.all([
    prisma.scanLog.count({ where: { scannedAt: { gte: today } } }),
    prisma.scanLog.count({ where: { scannedAt: { gte: today }, fraudFlag: true } }),
    prisma.manufacturer.count({ where: { onboardingStatus: "ACTIVE_PRODUCTION" } }),
    prisma.manufacturer.count({ where: { onboardingStatus: "PENDING_REVIEW" } }),
    prisma.alertLog.count({ where: { createdAt: { gte: today }, resolved: false } }),
    prisma.alertLog.count({ where: { severity: { in: ["HIGH_CONCERN", "CRITICAL"] }, resolved: false } }),
    prisma.batch.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * DAY) } } }),
    prisma.bottle.count({ where: { status: "OPENED", updatedAt: { gte: today } } }),
    prisma.alertLog.findMany({
      where: { resolved: false },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { manufacturer: { select: { companyName: true } } },
    }),
  ])

  return {
    scansToday,
    flaggedScansToday,
    flaggedRateToday: scansToday > 0 ? (flaggedScansToday / scansToday) * 100 : 0,
    activeManufacturers,
    pendingReview,
    alertsToday,
    highPriorityOpen,
    batchesLast30,
    openedToday,
    recentAlerts,
  }
}

async function getWeek() {
  const days = lastLagosDays(7)
  // One query for the whole week, grouped by Lagos calendar day
  const rows = await prisma.$queryRaw<{ day: string; total: bigint; flagged: bigint }[]>`
    SELECT to_char("scannedAt" + interval '1 hour', 'YYYY-MM-DD') AS day,
           count(*) AS total,
           count(*) FILTER (WHERE "fraudFlag" = true) AS flagged
    FROM "ScanLog"
    WHERE "scannedAt" >= ${days[0].start}
    GROUP BY 1
  `
  const byDay = new Map(rows.map((r) => [r.day, r]))
  return days.map(({ start, key }) => ({
    label: start.toLocaleDateString("en-NG", { weekday: "short", timeZone: "Africa/Lagos" }),
    total: Number(byDay.get(key)?.total ?? 0),
    flagged: Number(byDay.get(key)?.flagged ?? 0),
  }))
}

export default async function AdminOverviewPage() {
  await requireAdmin()
  const [m, week] = await Promise.all([getOverview(), getWeek()])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Overview"
        description="Activity across all manufacturers today."
      />

      {m.highPriorityOpen > 0 && (
        <Link
          href="/admin/alerts"
          className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 transition-colors hover:bg-red-500/15"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
          <p className="flex-1 text-sm text-red-100">
            <span className="font-semibold">
              {m.highPriorityOpen} high-priority {m.highPriorityOpen === 1 ? "alert is" : "alerts are"} open.
            </span>{" "}
            Review them in Alerts.
          </p>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Scans today" value={m.scansToday.toLocaleString()} hint="All channels" icon={ScanLine} />
        <StatCard
          label="Flagged scans today"
          value={`${m.flaggedRateToday.toFixed(1)}%`}
          hint={`${m.flaggedScansToday.toLocaleString()} of ${m.scansToday.toLocaleString()} scans`}
          icon={TrendingUp}
          tone={m.flaggedRateToday > 10 ? "bad" : m.flaggedRateToday > 5 ? "warn" : "neutral"}
        />
        <StatCard
          label="Open alerts raised today"
          value={m.alertsToday.toLocaleString()}
          hint={`${m.highPriorityOpen} high priority open in total`}
          icon={Bell}
          tone={m.highPriorityOpen > 0 ? "bad" : "neutral"}
        />
        <StatCard
          label="Live manufacturers"
          value={m.activeManufacturers.toLocaleString()}
          hint={`${m.pendingReview} waiting for review`}
          icon={Building2}
        />
        <StatCard label="Batches, last 30 days" value={m.batchesLast30.toLocaleString()} icon={Package} />
        <StatCard label="First openings today" value={m.openedToday.toLocaleString()} hint="Units verified as genuine" icon={ShieldCheck} tone="good" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className={`${card} lg:col-span-2`}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Latest open alerts</h2>
            <Link href="/admin/alerts" className="text-sm font-medium text-brand-400 hover:underline">
              View all
            </Link>
          </div>
          {m.recentAlerts.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No open alerts" description="New alerts from the daily fraud checks will show here." />
          ) : (
            <ul className="divide-y divide-gray-800">
              {m.recentAlerts.map((alert) => {
                const sev = SEVERITY[alert.severity]
                return (
                  <li key={alert.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={sev.tone}>{sev.label}</Badge>
                      <span className="text-xs text-gray-400">{ALERT_TYPE_LABELS[alert.type] ?? alert.type}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-gray-200">{alert.message}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {alert.manufacturer?.companyName ?? "All manufacturers"} · {timeAgo(alert.createdAt)}
                      {alert.confidenceScore ? ` · ${Math.round(alert.confidenceScore * 100)}% confidence` : ""}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className={`${card} lg:col-span-3`}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Scans, last 7 days</h2>
            <span className="text-xs text-gray-400">
              {week.reduce((a, d) => a + d.total, 0).toLocaleString()} total
            </span>
          </div>
          <div className="p-5">
            <WeekChart days={week} />
          </div>
        </section>
      </div>
    </div>
  )
}

function WeekChart({ days }: { days: { label: string; total: number; flagged: number }[] }) {
  const max = Math.max(...days.map((d) => d.total), 1)
  return (
    <figure>
      <div
        className="flex h-40 items-end gap-2"
        role="img"
        aria-label={days.map((d) => `${d.label}: ${d.total} scans, ${d.flagged} flagged`).join("; ")}
      >
        {days.map((d, i) => {
          const h = (d.total / max) * 100
          const flaggedShare = d.total > 0 ? (d.flagged / d.total) * 100 : 0
          return (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-xs tabular-nums text-gray-400">{d.total > 0 ? d.total.toLocaleString() : ""}</span>
              <div
                className="flex w-full max-w-12 flex-col overflow-hidden rounded-t-md bg-gray-800"
                style={{ height: `${Math.max(h, 2)}%` }}
              >
                <div className="w-full bg-red-500/80" style={{ height: `${flaggedShare}%` }} />
                <div className="w-full flex-1 bg-brand-500/70" style={{ display: d.total > 0 ? undefined : "none" }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {days.map((d, i) => (
          <span key={i} className="flex-1 text-center text-xs text-gray-500">
            {d.label}
          </span>
        ))}
      </div>
      <figcaption className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500/70" aria-hidden="true" /> Genuine
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500/80" aria-hidden="true" /> Flagged
        </span>
      </figcaption>
    </figure>
  )
}
