import type { Metadata } from "next"
import { Boxes, CheckCircle2, Package, ScanLine, TriangleAlert } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/workspace"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { card, cardHeader, cardTitle } from "@/lib/ui"
import { formatDate, formatNaira, humanize } from "@/lib/format"
import { PLAN_FEATURES, PLAN_PRICES, getMonthlyUsage } from "@/lib/plans"
import { UsageNotice } from "@/components/dashboard/usage-notice"

export const metadata: Metadata = { title: "Plan and usage" }

const SUPPORT = "support@verifychain.africa"

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "brand",
  PAST_DUE: "bad",
  SUSPENDED: "neutral",
  CANCELLED: "neutral",
}

export default async function DashboardBillingPage() {
  const { manufacturer } = await requireWorkspace("viewBilling")

  const [usage, unitsAllTime, totalScans, totalBatches, recentBatches] = await Promise.all([
    getMonthlyUsage(manufacturer.id, manufacturer.subscriptionPlan),
    prisma.bottle.count({ where: { manufacturerId: manufacturer.id } }),
    prisma.scanLog.count({ where: { manufacturerId: manufacturer.id } }),
    prisma.batch.count({ where: { manufacturerId: manufacturer.id } }),
    prisma.batch.findMany({
      where: { manufacturerId: manufacturer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        batchCode: true,
        bottleCount: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
  ])

  const plan = manufacturer.subscriptionPlan
  const planPrice = PLAN_PRICES[plan]
  const features = PLAN_FEATURES[plan]
  const { unlimited, limit: planLimit, used: unitsThisMonth, percent: usagePct } = usage
  const usageBar = usage.state === "over" ? "bg-red-500" : usage.state === "near" ? "bg-amber-500" : "bg-brand-500"

  return (
    <div className="space-y-8">
      <PageHeader
        title="Plan and usage"
        description={`${manufacturer.companyName} · Customer since ${formatDate(manufacturer.createdAt)}`}
      />

      {manufacturer.subscriptionStatus === "PAST_DUE" && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <p className="font-semibold">Your payment is overdue</p>
            <p className="mt-0.5">
              Your account may be suspended if it is not settled. Email{" "}
              <a href={`mailto:${SUPPORT}`} className="font-medium underline underline-offset-2">
                {SUPPORT}
              </a>{" "}
              to resolve it.
            </p>
          </div>
        </div>
      )}

      <UsageNotice usage={usage} showPlanLink={false} />

      <div className="grid gap-6 lg:grid-cols-5">
        <section className={`${card} lg:col-span-3`}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Current plan</h2>
            <Badge tone={STATUS_TONE[manufacturer.subscriptionStatus] ?? "neutral"}>
              {humanize(manufacturer.subscriptionStatus)}
            </Badge>
          </div>
          <div className="p-5">
            <p className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{humanize(plan)}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {planPrice === 0 ? "No monthly fee" : `${formatNaira(planPrice)} a month`}
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <p className="border-t border-gray-200 px-5 py-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
            To change your plan, email{" "}
            <a href={`mailto:${SUPPORT}`} className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400">
              {SUPPORT}
            </a>
            .
          </p>
        </section>

        <section className={`${card} lg:col-span-2`}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>This month</h2>
          </div>
          <div className="p-5">
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
              {unitsThisMonth.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {unlimited ? "units serialised, no monthly limit" : `of ${planLimit.toLocaleString()} units serialised`}
            </p>
            {!unlimited && (
              <>
                <div
                  className="mt-5 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(usagePct)}
                  aria-label="Monthly allowance used"
                >
                  <div className={`h-full rounded-full ${usageBar}`} style={{ width: `${usagePct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{usagePct.toFixed(1)}% used</span>
                  <span>{usage.remaining.toLocaleString()} left, resets {formatDate(usage.resetsOn)}</span>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Units serialised" value={unitsAllTime.toLocaleString()} hint="All time" icon={Package} />
        <StatCard label="Batches" value={totalBatches.toLocaleString()} hint="All time" icon={Boxes} />
        <StatCard label="Scans" value={totalScans.toLocaleString()} hint="All time" icon={ScanLine} />
      </div>

      <section className={card}>
        <div className={cardHeader}>
          <h2 className={cardTitle}>Recent batches</h2>
        </div>
        {recentBatches.length === 0 ? (
          <EmptyState icon={Boxes} title="No batches yet" description="Batches you generate count towards your monthly allowance." />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentBatches.map((batch) => (
              <li key={batch.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{batch.product?.name ?? "No product"}</p>
                  <p className="truncate font-mono text-xs text-gray-500 dark:text-gray-400">{batch.batchCode}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm tabular-nums text-gray-900 dark:text-white">{batch.bottleCount.toLocaleString()} units</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(batch.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
