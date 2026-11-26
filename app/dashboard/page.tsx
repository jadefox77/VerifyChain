import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Package,
  Scan,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  Zap,
  AlertTriangle,
} from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  // Batch 1
  const [totalBottles, totalScans, genuineScans] = await Promise.all([
    prisma.bottle.count({
      where: { manufacturerId: manufacturer.id },
    }),
    prisma.scanLog.count({
      where: { manufacturerId: manufacturer.id },
    }),
    prisma.scanLog.count({
      where: { manufacturerId: manufacturer.id, fraudFlag: false },
    }),
  ])

  // Batch 2
  const [fraudScans, openedBottles, flaggedBottles] = await Promise.all([
    prisma.scanLog.count({
      where: { manufacturerId: manufacturer.id, fraudFlag: true },
    }),
    prisma.bottle.count({
      where: { manufacturerId: manufacturer.id, status: "OPENED" },
    }),
    prisma.bottle.count({
      where: { manufacturerId: manufacturer.id, status: "FLAGGED" },
    }),
  ])

  // Batch 3
  const [mintBottles, activeBatches, unresolved] = await Promise.all([
    prisma.bottle.count({
      where: { manufacturerId: manufacturer.id, status: "MINT" },
    }),
    prisma.batch.count({
      where: { manufacturerId: manufacturer.id },
    }),
    prisma.alertLog.count({
      where: { manufacturerId: manufacturer.id, resolved: false },
    }),
  ])

  // Batch 4
  const [pairedProducts, singleProducts] =
    await Promise.all([
      prisma.product.count({
        where: {
          manufacturerId: manufacturer.id,
          authMode: "PAIRED",
        },
      }),
      prisma.product.count({
        where: {
          manufacturerId: manufacturer.id,
          authMode: "SINGLE",
        },
      }),
    ])

  const fraudRate =
    totalScans > 0
      ? ((fraudScans / totalScans) * 100).toFixed(1)
      : "0.0"

  const fraudAccent =
    parseFloat(fraudRate) > 10
      ? "text-red-500"
      : parseFloat(fraudRate) > 5
      ? "text-orange-500"
      : "text-green-500"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Overview
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {manufacturer.companyName} · {manufacturer.subscriptionPlan} plan
        </p>
      </div>

      {/* Alert banner if unresolved alerts */}
      {unresolved > 0 && (
        <Link
          href="/dashboard/fraud"
          className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
        >
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {unresolved} unresolved fraud alert
              {unresolved !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400/70 mt-0.5">
              Review and resolve in the Fraud Alerts section
            </p>
          </div>
          <span className="text-xs text-red-500 font-mono">
            View →
          </span>
        </Link>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Bottles",
            value: totalBottles.toLocaleString(),
            icon: Package,
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-500/10",
          },
          {
            label: "Total Scans",
            value: totalScans.toLocaleString(),
            icon: Scan,
            color: "text-purple-500",
            bg: "bg-purple-50 dark:bg-purple-500/10",
          },
          {
            label: "Genuine Scans",
            value: genuineScans.toLocaleString(),
            icon: ShieldCheck,
            color: "text-green-500",
            bg: "bg-green-50 dark:bg-green-500/10",
          },
          {
            label: "Fraud Rate",
            value: `${fraudRate}%`,
            icon: ShieldX,
            color: fraudAccent,
            bg:
              parseFloat(fraudRate) > 5
                ? "bg-red-50 dark:bg-red-500/10"
                : "bg-gray-50 dark:bg-gray-800/60",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm"
          >
            <div
              className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}
            >
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
              {card.value}
            </p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Bottle status breakdown */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Bottle Status Breakdown
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Mint",
              value: mintBottles,
              color: "text-gray-500",
              bar: "bg-gray-400",
            },
            {
              label: "Opened",
              value: openedBottles,
              color: "text-green-500",
              bar: "bg-green-500",
            },
            {
              label: "Flagged",
              value: flaggedBottles,
              color: "text-red-500",
              bar: "bg-red-500",
            },
          ].map((item) => {
            const pct =
              totalBottles > 0
                ? (item.value / totalBottles) * 100
                : 0
            return (
              <div key={item.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-gray-500">
                    {item.label}
                  </span>
                  <span
                    className={`text-xs font-mono font-bold ${item.color}`}
                  >
                    {item.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-mono mt-1">
                  {pct.toFixed(1)}%
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Secondary stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          {
            label: "Active Batches",
            value: activeBatches.toLocaleString(),
            icon: Package,
            sub: "Total generated",
          },
          {
            label: "First-Open Events",
            value: openedBottles.toLocaleString(),
            icon: Zap,
            sub: "Confirmed genuine",
          },
          {
            label: "Fraud Flags",
            value: fraudScans.toLocaleString(),
            icon: TrendingUp,
            sub: "Total scan flags",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
            <p className="text-xl font-bold font-mono text-gray-900 dark:text-white">
              {card.value}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Auth mode breakdown */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Product Authentication Modes
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl">
            <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {pairedProducts}
            </p>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mt-1">
              Paired Mode Products
            </p>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/60 mt-0.5">
              Bottle QR + Hidden Cap QR
            </p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl">
            <p className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">
              {singleProducts}
            </p>
            <p className="text-sm font-medium text-green-700 dark:text-green-300 mt-1">
              Single Mode Products
            </p>
            <p className="text-xs text-green-600/70 dark:text-green-400/60 mt-0.5">
              One QR per unit
            </p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Generate Batch",
            href: "/dashboard/batches",
            desc: "Create new serialized batch",
          },
          {
            label: "View Scan Logs",
            href: "/dashboard/scans",
            desc: "Review verification activity",
          },
          {
            label: "Fraud Alerts",
            href: "/dashboard/fraud",
            desc: "Monitor fraud intelligence",
          },
          {
            label: "Billing",
            href: "/dashboard/billing",
            desc: "Subscription and usage",
          },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors shadow-sm"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {link.label}
            </p>
            <p className="text-xs text-gray-500 mt-1">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}