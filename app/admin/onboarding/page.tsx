import { requireAdmin, canWrite } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  Building2,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"

export const revalidate = 30

const PIPELINE_STAGES = [
  {
    key: "PENDING_REVIEW",
    label: "Pending Review",
    description: "Submitted, awaiting VerifyChain review",
    color: "border-yellow-500/30",
    headerColor: "text-yellow-400",
    dotColor: "bg-yellow-500",
    countStyle: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  {
    key: "COMPLIANCE_VERIFICATION",
    label: "Compliance",
    description: "RC number and NAFDAC check in progress",
    color: "border-blue-500/30",
    headerColor: "text-blue-400",
    dotColor: "bg-blue-500",
    countStyle: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    key: "TECHNICAL_INTEGRATION",
    label: "Technical",
    description: "API keys issued, integration being configured",
    color: "border-purple-500/30",
    headerColor: "text-purple-400",
    dotColor: "bg-purple-500",
    countStyle: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  {
    key: "PILOT_APPROVAL",
    label: "Pilot",
    description: "Test batch running, awaiting sign-off",
    color: "border-orange-500/30",
    headerColor: "text-orange-400",
    dotColor: "bg-orange-500",
    countStyle: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  {
    key: "ACTIVE_PRODUCTION",
    label: "Active",
    description: "Fully onboarded and live on platform",
    color: "border-green-500/30",
    headerColor: "text-green-400",
    dotColor: "bg-green-500",
    countStyle: "bg-green-500/10 text-green-400 border-green-500/20",
  },
]

const STAGE_KEYS = PIPELINE_STAGES.map((s) => s.key)

async function getPipelineData() {
  const manufacturers = await prisma.manufacturer.findMany({
    where: {
      onboardingStatus: {
        in: [
          "PENDING_REVIEW",
          "COMPLIANCE_VERIFICATION",
          "TECHNICAL_INTEGRATION",
          "PILOT_APPROVAL",
          "ACTIVE_PRODUCTION",
        ] as any,
      },
    },
    select: {
      id: true,
      companyName: true,
      rcNumber: true,
      onboardingStatus: true,
      subscriptionPlan: true,
      createdAt: true,
      updatedAt: true,
      primaryContact: true,
      adminNotes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "asc" },
  })

  const grouped = STAGE_KEYS.reduce(
    (acc, key) => {
      acc[key] = manufacturers.filter(
        (m) => m.onboardingStatus === key
      )
      return acc
    },
    {} as Record<string, typeof manufacturers>
  )

  return grouped
}

async function getRejectedAndSuspended() {
  return prisma.manufacturer.findMany({
    where: {
      onboardingStatus: { in: ["REJECTED", "SUSPENDED"] as any },
    },
    select: {
      id: true,
      companyName: true,
      rcNumber: true,
      onboardingStatus: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  })
}

function daysInStage(updatedAt: Date): number {
  return Math.floor(
    (Date.now() - new Date(updatedAt).getTime()) /
      (1000 * 60 * 60 * 24)
  )
}

function daysInStageStyle(days: number): string {
  if (days > 14) return "text-red-400"
  if (days > 7) return "text-orange-400"
  return "text-gray-500"
}

export default async function OnboardingPipelinePage() {
  const session = await requireAdmin()
  const [pipeline, offtrack] = await Promise.all([
    getPipelineData(),
    getRejectedAndSuspended(),
  ])

  const canEdit = canWrite(session.user.role)
  const totalInPipeline = Object.values(pipeline).reduce(
    (sum, arr) => sum + arr.length,
    0
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Onboarding Pipeline
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {totalInPipeline} manufacturers in pipeline ·{" "}
            {pipeline["PENDING_REVIEW"]?.length ?? 0} awaiting review
          </p>
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
        {PIPELINE_STAGES.map((stage) => {
          const cards = pipeline[stage.key] ?? []

          return (
            <div
              key={stage.key}
              className={`bg-gray-900/40 border rounded-xl overflow-hidden ${stage.color}`}
            >
              {/* Column header */}
              <div className="px-3 py-3 border-b border-gray-800/60">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${stage.dotColor}`}
                    />
                    <span
                      className={`text-xs font-mono font-bold ${stage.headerColor}`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${stage.countStyle}`}
                  >
                    {cards.length}
                  </span>
                </div>
                <p className="text-[9px] text-gray-600 font-mono pl-3.5">
                  {stage.description}
                </p>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[120px]">
                {cards.length === 0 ? (
                  <div className="flex items-center justify-center h-16">
                    <p className="text-[10px] text-gray-700 font-mono">
                      No manufacturers
                    </p>
                  </div>
                ) : (
                  cards.map((m) => {
                    const days = daysInStage(m.updatedAt)
                    const daysStyle = daysInStageStyle(days)
                    const stageIndex = STAGE_KEYS.indexOf(
                      m.onboardingStatus
                    )
                    const nextStage = PIPELINE_STAGES[stageIndex + 1]
                    const isLastStage =
                      m.onboardingStatus === "ACTIVE_PRODUCTION"

                    return (
                      <div
                        key={m.id}
                        className="bg-gray-900/80 border border-gray-800/60 rounded-lg p-3 hover:border-gray-700/60 transition-colors"
                      >
                        {/* Company name + link */}
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Building2 className="w-3 h-3 text-gray-600 shrink-0" />
                            <span className="text-xs font-medium text-gray-200 truncate">
                              {m.companyName}
                            </span>
                          </div>
                          <Link
                            href={`/admin/manufacturers/${m.id}`}
                            className="shrink-0 text-gray-600 hover:text-blue-400 transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>

                        {/* RC number */}
                        <p className="text-[10px] font-mono text-gray-600 mb-2">
                          {m.rcNumber ?? "RC not provided"}
                        </p>

                        {/* Days in stage */}
                        <div className="flex items-center gap-1 mb-3">
                          <Clock className="w-3 h-3 text-gray-700" />
                          <span
                            className={`text-[10px] font-mono ${daysStyle}`}
                          >
                            {days === 0
                              ? "Today"
                              : `${days}d in stage`}
                          </span>
                          {days > 7 && (
                            <AlertCircle className="w-3 h-3 text-orange-500 ml-0.5" />
                          )}
                        </div>

                        {/* Last admin note */}
                        {m.adminNotes[0] && (
                          <p className="text-[10px] text-gray-600 italic mb-2 line-clamp-1">
                            "{m.adminNotes[0].content}"
                          </p>
                        )}

                        {/* Actions */}
                        {canEdit && !isLastStage && (
                          <div className="flex gap-1.5 mt-2">
                            <form
                              action={`/api/admin/manufacturers/${m.id}/advance`}
                              method="POST"
                              className="flex-1"
                            >
                              <button
                                type="submit"
                                className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {nextStage
                                  ? `→ ${nextStage.label}`
                                  : "Advance"}
                              </button>
                            </form>

                            <form
                              action={`/api/admin/manufacturers/${m.id}/reject`}
                              method="POST"
                            >
                              <button
                                type="submit"
                                className="px-2 py-1 text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors"
                                title="Reject"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            </form>
                          </div>
                        )}

                        {isLastStage && (
                          <div className="flex items-center gap-1 mt-2">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            <span className="text-[10px] font-mono text-green-500">
                              Live
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Rejected / Suspended table */}
      {offtrack.length > 0 && (
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800/60">
            <h2 className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              Rejected & Suspended
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800/40">
                {[
                  "Company",
                  "RC Number",
                  "Status",
                  "Last Updated",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-[10px] font-mono text-gray-600 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {offtrack.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-gray-800/20 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className="text-sm text-gray-400">
                      {m.companyName}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono text-gray-600">
                      {m.rcNumber ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        m.onboardingStatus === "REJECTED"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                      }`}
                    >
                      {m.onboardingStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono text-gray-600">
                      {new Date(m.updatedAt).toLocaleDateString(
                        "en-NG",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/manufacturers/${m.id}`}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-400 transition-colors font-mono"
                    >
                      View
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}