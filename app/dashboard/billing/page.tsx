import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import {
  CreditCard,
  Package,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react"

const PLAN_LIMITS: Record<string, number> = {
  FREE: 5000,
  STARTER: 50000,
  PROFESSIONAL: 500000,
  ENTERPRISE: Infinity,
}

const PLAN_PRICES: Record<string, number> = {
  FREE: 0,
  STARTER: 150000,
  PROFESSIONAL: 500000,
  ENTERPRISE: 1500000,
}

const PLAN_FEATURES: Record<string, string[]> = {
  FREE: [
    "Up to 5,000 bottles/month",
    "Basic verification",
    "Standard support",
  ],
  STARTER: [
    "Up to 50,000 bottles/month",
    "Full fraud detection",
    "Scan analytics",
    "Email support",
  ],
  PROFESSIONAL: [
    "Up to 500,000 bottles/month",
    "Advanced fraud intelligence",
    "Geographic analytics",
    "Supply chain monitoring",
    "Priority support",
  ],
  ENTERPRISE: [
    "Unlimited bottles",
    "Full platform access",
    "Dedicated fraud analyst",
    "Custom integrations",
    "24/7 support",
    "Regulatory reporting",
  ],
}

async function getManufacturerBilling(userId: string) {
  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId },
    select: {
      id: true,
      companyName: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      totalBottlesGenerated: true,
      estimatedBottlesPerMonth: true,
      createdAt: true,
    },
  })

  if (!manufacturer) return null

  // Batch
  const [totalScans, totalBatches, recentBatches] = await Promise.all([
    prisma.scanLog.count({
      where: { manufacturerId: manufacturer.id },
    }),
    prisma.batch.count({
      where: { manufacturerId: manufacturer.id },
    }),
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

  return {
    ...manufacturer,
    totalScans,
    totalBatches,
    recentBatches,
  }
}

export default async function DashboardBillingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const data = await getManufacturerBilling(session.user.id)
  if (!data) redirect("/onboarding")

  const planLimit = PLAN_LIMITS[data.subscriptionPlan]
  const planPrice = PLAN_PRICES[data.subscriptionPlan]
  const features = PLAN_FEATURES[data.subscriptionPlan]

  const usagePct =
    planLimit === Infinity
      ? 0
      : Math.min((data.totalBottlesGenerated / planLimit) * 100, 100)

  const usageColor =
    usagePct > 90
      ? "bg-red-500/60"
      : usagePct > 70
      ? "bg-orange-500/60"
      : "bg-green-500/40"

  const isOverLimit =
    planLimit !== Infinity && data.totalBottlesGenerated > planLimit

  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  thisMonthStart.setHours(0, 0, 0, 0)

  const bottlesThisMonth = await prisma.bottle.count({
    where: {
      manufacturerId: data.id,
      createdAt: { gte: thisMonthStart },
    },
  })

  return (
    <div className="p-6 space-y-6 max-w-[1000px]">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Billing & Subscription
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {data.companyName} · Member since{" "}
          {new Date(data.createdAt).toLocaleDateString("en-NG", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Status banner */}
      {data.subscriptionStatus === "PAST_DUE" && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-400">
              Payment Past Due
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              Your account may be suspended. Please contact
              support@verifychain.africa to resolve.
            </p>
          </div>
        </div>
      )}

      {isOverLimit && (
        <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-400">
              Plan Limit Exceeded
            </p>
            <p className="text-xs text-orange-400/70 mt-0.5">
              You have exceeded your plan's bottle limit. Please upgrade
              to continue serializing.
            </p>
          </div>
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-gray-500" />
              <p className="text-xs text-gray-500 uppercase tracking-wider font-mono">
                Current Plan
              </p>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {data.subscriptionPlan.charAt(0) +
                data.subscriptionPlan.slice(1).toLowerCase()}{" "}
              Plan
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {planPrice === 0
                ? "Free forever"
                : `₦${planPrice.toLocaleString()} / month`}
            </p>
          </div>
          <span
            className={`text-xs font-mono px-2.5 py-1 rounded-lg border ${
              data.subscriptionStatus === "ACTIVE"
                ? "bg-green-500/10 text-green-600 border-green-500/20"
                : data.subscriptionStatus === "PAST_DUE"
                ? "bg-red-500/10 text-red-500 border-red-500/20"
                : "bg-gray-500/10 text-gray-500 border-gray-500/20"
            }`}
          >
            {data.subscriptionStatus}
          </span>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {f}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800/60">
          <p className="text-xs text-gray-500">
            To upgrade or change your plan contact{" "}
            <a
              href="mailto:support@verifychain.africa"
              className="text-blue-500 hover:underline"
            >
              support@verifychain.africa
            </a>
          </p>
        </div>
      </div>

      {/* Usage metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: "Bottles This Month",
            value: bottlesThisMonth.toLocaleString(),
            icon: Package,
            sub:
              planLimit === Infinity
                ? "Unlimited plan"
                : `of ${planLimit.toLocaleString()} limit`,
          },
          {
            label: "Total Serialized",
            value: data.totalBottlesGenerated.toLocaleString(),
            icon: TrendingUp,
            sub: "All time",
          },
          {
            label: "Total Scans",
            value: data.totalScans.toLocaleString(),
            icon: Clock,
            sub: `across ${data.totalBatches} batches`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-4 h-4 text-gray-500" />
              <p className="text-xs text-gray-500 uppercase tracking-wider font-mono">
                {card.label}
              </p>
            </div>
            <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white">
              {card.value}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Usage bar */}
      {planLimit !== Infinity && (
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Plan Usage
            </p>
            <span className="text-sm font-mono text-gray-500">
              {data.totalBottlesGenerated.toLocaleString()} /{" "}
              {planLimit.toLocaleString()}
            </span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usageColor}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-500 font-mono">
              {usagePct.toFixed(1)}% used
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {Math.max(
                planLimit - data.totalBottlesGenerated,
                0
              ).toLocaleString()}{" "}
              remaining
            </span>
          </div>
        </div>
      )}

      {/* Recent batches */}
      <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800/60">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Recent Serialization Activity
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800/40">
          {data.recentBatches.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-500">No batches yet</p>
            </div>
          ) : (
            data.recentBatches.map((batch) => (
              <div
                key={batch.id}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {batch.batchCode}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {batch.product?.name ?? "No product"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-blue-500">
                    {batch.bottleCount.toLocaleString()} bottles
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(batch.createdAt).toLocaleDateString(
                      "en-NG",
                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}