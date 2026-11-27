import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Circle,
  Package,
  ScanLine,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { buttonPrimary, buttonSecondary, card, cardHeader, cardTitle } from "@/lib/ui"
import { formatDate, humanize } from "@/lib/format"
import { getMonthlyUsage } from "@/lib/plans"
import { UsageNotice } from "@/components/dashboard/usage-notice"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const m = manufacturer.id
  const [
    totalUnits,
    totalScans,
    flaggedScans,
    openedUnits,
    flaggedUnits,
    batchCount,
    unresolvedAlerts,
    pairedProducts,
    singleProducts,
    recentScans,
    usage,
  ] = await Promise.all([
    prisma.bottle.count({ where: { manufacturerId: m } }),
    prisma.scanLog.count({ where: { manufacturerId: m } }),
    prisma.scanLog.count({ where: { manufacturerId: m, fraudFlag: true } }),
    prisma.bottle.count({ where: { manufacturerId: m, status: "OPENED" } }),
    prisma.bottle.count({ where: { manufacturerId: m, status: "FLAGGED" } }),
    prisma.batch.count({ where: { manufacturerId: m } }),
    prisma.alertLog.count({ where: { manufacturerId: m, resolved: false } }),
    prisma.product.count({ where: { manufacturerId: m, authMode: "PAIRED" } }),
    prisma.product.count({ where: { manufacturerId: m, authMode: "SINGLE" } }),
    prisma.scanLog.findMany({
      where: { manufacturerId: m },
      orderBy: { scannedAt: "desc" },
      take: 6,
      select: {
        id: true,
        scannedAt: true,
        scanLayer: true,
        fraudFlag: true,
        flagReason: true,
        bottle: { select: { batch: { select: { product: { select: { name: true } } } } } },
      },
    }),
    getMonthlyUsage(m, manufacturer.subscriptionPlan),
  ])

  const unopenedUnits = Math.max(totalUnits - openedUnits - flaggedUnits, 0)
  const productCount = pairedProducts + singleProducts
  const flaggedRate = totalScans > 0 ? (flaggedScans / totalScans) * 100 : 0
  const isNew = productCount === 0 || batchCount === 0

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description={`${manufacturer.companyName} · ${humanize(manufacturer.subscriptionPlan)} plan`}
        actions={
          <Link href="/dashboard/batches" className={buttonPrimary}>
            <Boxes className="h-4 w-4" aria-hidden="true" />
            New batch
          </Link>
        }
      />

      <UsageNotice usage={usage} />

      {unresolvedAlerts > 0 && (
        <Link
          href="/dashboard/fraud"
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:hover:bg-red-500/15"
        >
          <TriangleAlert className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              {unresolvedAlerts} open fraud {unresolvedAlerts === 1 ? "alert needs" : "alerts need"} your attention
            </p>
            <p className="mt-0.5 text-sm text-red-700/90 dark:text-red-200/80">
              Review where and when the suspicious scans happened.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
        </Link>
      )}

      {isNew && <GettingStarted hasProduct={productCount > 0} hasBatch={batchCount > 0} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Units serialised" value={totalUnits.toLocaleString()} hint={`Across ${batchCount} ${batchCount === 1 ? "batch" : "batches"}`} icon={Package} />
        <StatCard label="Scans" value={totalScans.toLocaleString()} hint="All verification attempts" icon={ScanLine} />
        <StatCard
          label="Confirmed first openings"
          value={openedUnits.toLocaleString()}
          hint="Units verified as genuine"
          icon={CheckCircle2}
          tone="good"
        />
        <StatCard
          label="Flagged scans"
          value={`${flaggedRate.toFixed(1)}%`}
          hint={`${flaggedScans.toLocaleString()} of ${totalScans.toLocaleString()} scans`}
          icon={ShieldAlert}
          tone={flaggedRate > 10 ? "bad" : flaggedRate > 5 ? "warn" : "neutral"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className={`${card} lg:col-span-3`}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Unit status</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">{totalUnits.toLocaleString()} units</span>
          </div>
          <div className="p-5">
            <UnitStatusBar unopened={unopenedUnits} opened={openedUnits} flagged={flaggedUnits} />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-gray-200 p-5 dark:border-gray-800">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Two-code products</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{pairedProducts}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Bottle label and hidden cap code</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Single-code products</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{singleProducts}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">One code per unit</p>
            </div>
          </div>
        </section>

        <section className={`${card} lg:col-span-2`}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Latest scans</h2>
            <Link href="/dashboard/scans" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
              View all
            </Link>
          </div>
          {recentScans.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title="No scans yet"
              description="Scans appear here as soon as shoppers start checking your products."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentScans.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {s.bottle?.batch?.product?.name ?? "Unknown product"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {s.scanLayer === "CAP" ? "Cap" : "Label"} · {formatDate(s.scannedAt, true)}
                    </p>
                  </div>
                  {s.fraudFlag ? <Badge tone="bad">Flagged</Badge> : <Badge tone="brand">Genuine</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function UnitStatusBar({ unopened, opened, flagged }: { unopened: number; opened: number; flagged: number }) {
  const total = unopened + opened + flagged
  const segments = [
    { label: "Unopened", value: unopened, bar: "bg-gray-300 dark:bg-gray-600", dot: "bg-gray-300 dark:bg-gray-600" },
    { label: "Opened and verified", value: opened, bar: "bg-brand-500", dot: "bg-brand-500" },
    { label: "Flagged", value: flagged, bar: "bg-red-500", dot: "bg-red-500" },
  ]
  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
      >
        {total > 0 &&
          segments.map((s) =>
            s.value > 0 ? <div key={s.label} className={s.bar} style={{ width: `${(s.value / total) * 100}%` }} /> : null
          )}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-start gap-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
            <div>
              <dt className="text-sm text-gray-600 dark:text-gray-400">{s.label}</dt>
              <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                {s.value.toLocaleString()}
                <span className="ml-1.5 font-normal text-gray-500 dark:text-gray-400">
                  {total > 0 ? `${((s.value / total) * 100).toFixed(1)}%` : "0%"}
                </span>
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  )
}

function GettingStarted({ hasProduct, hasBatch }: { hasProduct: boolean; hasBatch: boolean }) {
  const steps = [
    {
      done: hasProduct,
      title: "Add a product",
      body: "Choose whether it uses two codes (bottle and cap) or a single code.",
      href: "/dashboard/products",
      cta: "Add product",
    },
    {
      done: hasBatch,
      title: "Generate a batch",
      body: "Create unique codes for one production run.",
      href: "/dashboard/batches",
      cta: "Generate batch",
    },
    {
      done: false,
      title: "Download and print",
      body: "Open the batch and download the QR images for your printer.",
      href: "/dashboard/batches",
      cta: "Go to batches",
    },
  ]
  const next = steps.findIndex((s) => !s.done)

  return (
    <section className={card}>
      <div className={cardHeader}>
        <div>
          <h2 className={cardTitle}>Get your first batch ready</h2>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">Three steps to put verifiable codes on your products.</p>
        </div>
      </div>
      <ol className="grid gap-px bg-gray-200 sm:grid-cols-3 dark:bg-gray-800">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-col bg-white p-5 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              {s.done ? (
                <CheckCircle2 className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              ) : (
                <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600" aria-hidden="true" />
              )}
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {s.title}
                {s.done && <span className="sr-only"> (done)</span>}
              </p>
            </div>
            <p className="mt-1.5 flex-1 text-sm text-gray-600 dark:text-gray-400">{s.body}</p>
            {i === next && (
              <Link href={s.href} className={`${i === 0 ? buttonPrimary : buttonSecondary} mt-4 self-start px-3 py-2`}>
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
