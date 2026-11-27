import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import type { OnboardingStatus, SubscriptionPlan } from "@prisma/client"
import {
  Building2,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react"

export const revalidate = 30

const ONBOARDING_STATUS_CONFIG = {
  PENDING_REVIEW: {
    label: "Pending Review",
    style: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  COMPLIANCE_VERIFICATION: {
    label: "Compliance",
    style: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  TECHNICAL_INTEGRATION: {
    label: "Technical",
    style: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  PILOT_APPROVAL: {
    label: "Pilot",
    style: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  ACTIVE_PRODUCTION: {
    label: "Active",
    style: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  REJECTED: {
    label: "Rejected",
    style: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  SUSPENDED: {
    label: "Suspended",
    style: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
}

const PLAN_CONFIG = {
  FREE: { label: "Free", style: "text-gray-500" },
  STARTER: { label: "Starter", style: "text-blue-400" },
  PROFESSIONAL: { label: "Professional", style: "text-purple-400" },
  ENTERPRISE: { label: "Enterprise", style: "text-orange-400" },
}

async function getManufacturers(
  status?: string,
  plan?: string,
  search?: string
) {
  return prisma.manufacturer.findMany({
    where: {
      ...(status && status !== "ALL"
        ? { onboardingStatus: status as OnboardingStatus }
        : {}),
      ...(plan && plan !== "ALL"
        ? { subscriptionPlan: plan as SubscriptionPlan }
        : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: "insensitive" } },
              { rcNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      companyName: true,
      rcNumber: true,
      onboardingStatus: true,
      subscriptionPlan: true,
      totalBottlesGenerated: true,
      fraudRateCached: true,
      createdAt: true,
      _count: {
        select: { scanLogs: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

async function getStatusCounts() {
  return prisma.manufacturer.groupBy({
    by: ["onboardingStatus"],
    _count: true,
  })
}

export default async function ManufacturersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; plan?: string; search?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const { status, plan, search } = params

  const [manufacturers, statusCounts] = await Promise.all([
    getManufacturers(status, plan, search),
    getStatusCounts(),
  ])

  const totalCount = statusCounts.reduce((sum, s) => sum + s._count, 0)
  const activeCount =
    statusCounts.find((s) => s.onboardingStatus === "ACTIVE_PRODUCTION")
      ?._count ?? 0
  const pendingCount =
    statusCounts.find((s) => s.onboardingStatus === "PENDING_REVIEW")
      ?._count ?? 0

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Manufacturers
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalCount} registered, {activeCount} live, {pendingCount}{" "}
            waiting for review
          </p>
        </div>
        <Link
          href="/admin/manufacturers/create"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-brand-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create account
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: "ALL", label: "All" },
          { key: "PENDING_REVIEW", label: "Pending" },
          { key: "COMPLIANCE_VERIFICATION", label: "Compliance" },
          { key: "TECHNICAL_INTEGRATION", label: "Technical" },
          { key: "PILOT_APPROVAL", label: "Pilot" },
          { key: "ACTIVE_PRODUCTION", label: "Live" },
          { key: "REJECTED", label: "Rejected" },
          { key: "SUSPENDED", label: "Suspended" },
        ].map((tab) => {
          const count =
            tab.key === "ALL"
              ? totalCount
              : (statusCounts.find((s) => s.onboardingStatus === tab.key)
                  ?._count ?? 0)
          const isActive = (status ?? "ALL") === tab.key

          return (
            <Link
              key={tab.key}
              href={`/admin/manufacturers?status=${tab.key}${plan ? `&plan=${plan}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                isActive
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "text-gray-500 border-gray-800 hover:text-gray-300 hover:border-gray-700"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-60">{count}</span>
            </Link>
          )
        })}
      </div>

      {/* Search + plan filter */}
      <div>
        <form method="GET" action="/admin/manufacturers" className="flex flex-wrap gap-3">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              name="search"
              type="search"
              aria-label="Search manufacturers"
              defaultValue={search}
              placeholder="Company name or RC number"
              className="w-full bg-gray-900/60 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-700"
            />
          </div>
          <select
            name="plan"
            aria-label="Plan"
            defaultValue={plan ?? "ALL"}
            className="bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-400 focus:outline-none focus:border-gray-700"
          >
            <option value="ALL">All plans</option>
            <option value="FREE">Free</option>
            <option value="STARTER">Starter</option>
            <option value="PROFESSIONAL">Professional</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="table-scroll">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-800/60">
              {[
                "Company",
                "RC number",
                "Status",
                "Plan",
                "Units",
                "Flagged rate",
                "Joined",
                "",
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
            {manufacturers.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  No manufacturers found
                </td>
              </tr>
            ) : (
              manufacturers.map((m) => {
                const statusConfig =
                  ONBOARDING_STATUS_CONFIG[m.onboardingStatus]
                const planConfig = PLAN_CONFIG[m.subscriptionPlan]
                const fraudRateDisplay =
                  m.fraudRateCached > 0
                    ? `${m.fraudRateCached.toFixed(1)}%`
                    : "0.0%"
                const fraudAccent =
                  m.fraudRateCached > 15
                    ? "text-red-400"
                    : m.fraudRateCached > 5
                    ? "text-orange-400"
                    : "text-green-400"

                return (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-gray-500" />
                        </div>
                        <span className="text-sm text-gray-200 font-medium">
                          {m.companyName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-500">
                        {m.rcNumber ?? "Not provided"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${statusConfig.style}`}
                      >
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs ${planConfig.style}`}
                      >
                        {planConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {m.totalBottlesGenerated.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs ${fraudAccent}`}
                      >
                        {fraudRateDisplay}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {new Date(m.createdAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/manufacturers/${m.id}`}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors"
                      >
                        View
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}