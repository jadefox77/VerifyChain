import { requireAdmin, canWrite, isSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  Building2,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Package,
  ShieldAlert,
  Activity,
  ChevronRight,
} from "lucide-react"

export const revalidate = 30

const ONBOARDING_STAGES = [
  { key: "PENDING_REVIEW", label: "Pending Review", step: 1 },
  { key: "COMPLIANCE_VERIFICATION", label: "Compliance", step: 2 },
  { key: "TECHNICAL_INTEGRATION", label: "Technical", step: 3 },
  { key: "PILOT_APPROVAL", label: "Pilot", step: 4 },
  { key: "ACTIVE_PRODUCTION", label: "Active", step: 5 },
]

async function getManufacturerProfile(id: string) {
  return prisma.manufacturer.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      batches: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          product: { select: { name: true } },
          _count: { select: { bottles: true } },
        },
      },
      alertLogs: {
        where: { resolved: false },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      adminNotes: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: {
        select: {
          bottles: true,
          scanLogs: true,
          batches: true,
          alertLogs: true,
        },
      },
    },
  })
}

const SEVERITY_CONFIG = {
  SAFE: { style: "bg-green-500/10 text-green-400 border-green-500/20", label: "Safe" },
  SUSPICIOUS: { style: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Suspicious" },
  HIGH_CONCERN: { style: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "High Concern" },
  CRITICAL: { style: "bg-red-500/10 text-red-400 border-red-500/20", label: "Critical" },
}

export default async function ManufacturerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAdmin()
  const { id } = await params
  const manufacturer = await getManufacturerProfile(id)

  if (!manufacturer) notFound()

  const currentStepIndex = ONBOARDING_STAGES.findIndex(
    (s) => s.key === manufacturer.onboardingStatus
  )

  const canEdit = canWrite(session.user.role)
  const isSuper = isSuperAdmin(session.user.role)

  const fraudRate = manufacturer.fraudRateCached

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Back + header */}
      <div>
        <Link
          href="/admin/manufacturers"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 font-mono mb-4 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Manufacturers
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                {manufacturer.companyName}
              </h1>
              <p className="text-xs font-mono text-gray-500 mt-0.5">
                RC: {manufacturer.rcNumber ?? "Not provided"} ·{" "}
                {manufacturer.industryType ?? "Industry not set"}
              </p>
            </div>
          </div>

          {/* Account actions */}
          {isSuper && (
            <div className="flex items-center gap-2">
              {manufacturer.onboardingStatus === "SUSPENDED" ? (
                <form action={`/api/admin/manufacturers/${id}/activate`} method="POST">
                  <button className="px-3 py-1.5 text-xs font-mono bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors">
                    Activate Account
                  </button>
                </form>
              ) : (
                <form action={`/api/admin/manufacturers/${id}/suspend`} method="POST">
                  <button className="px-3 py-1.5 text-xs font-mono bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">
                    Suspend Account
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Onboarding progress */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Onboarding Status
          </h2>
          {canEdit &&
            manufacturer.onboardingStatus !== "ACTIVE_PRODUCTION" &&
            manufacturer.onboardingStatus !== "REJECTED" &&
            manufacturer.onboardingStatus !== "SUSPENDED" && (
              <AdvanceStageForm
                manufacturerId={id}
                currentStatus={manufacturer.onboardingStatus}
              />
            )}
        </div>

        <div className="flex items-center gap-0">
          {ONBOARDING_STAGES.map((stage, i) => {
            const isDone = i < currentStepIndex
            const isCurrent = i === currentStepIndex
            const isLast = i === ONBOARDING_STAGES.length - 1

            return (
              <div key={stage.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-mono mb-1 transition-colors ${
                      isDone
                        ? "bg-green-500/20 border-green-500/40 text-green-400"
                        : isCurrent
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                        : "bg-gray-800 border-gray-700 text-gray-600"
                    }`}
                  >
                    {isDone ? "✓" : stage.step}
                  </div>
                  <span
                    className={`text-[9px] font-mono text-center ${
                      isCurrent ? "text-blue-400" : isDone ? "text-green-400" : "text-gray-600"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className={`h-px flex-1 mb-4 ${
                      isDone ? "bg-green-500/30" : "bg-gray-800"
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total Bottles",
            value: manufacturer._count.bottles.toLocaleString(),
            icon: Package,
          },
          {
            label: "Total Scans",
            value: manufacturer._count.scanLogs.toLocaleString(),
            icon: Activity,
          },
          {
            label: "Active Batches",
            value: manufacturer._count.batches.toLocaleString(),
            icon: Package,
          },
          {
            label: "Fraud Rate",
            value: `${fraudRate.toFixed(1)}%`,
            icon: ShieldAlert,
            accent: fraudRate > 10 ? "text-red-400" : fraudRate > 5 ? "text-orange-400" : "text-green-400",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4"
          >
            <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-2">
              {card.label}
            </p>
            <p className={`text-2xl font-bold font-mono ${card.accent ?? "text-white"}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Company details */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4 space-y-4">
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Company Details
          </h2>

          <div className="space-y-3">
            {[
              {
                icon: Building2,
                label: "Tax ID",
                value: manufacturer.taxId,
              },
              {
                icon: MapPin,
                label: "Locations",
                value: manufacturer.factoryLocations,
              },
              {
                icon: Phone,
                label: "Phone",
                value: manufacturer.phone,
              },
              {
                icon: Mail,
                label: "Contact",
                value: manufacturer.primaryContact,
              },
            ].map((field) => (
              <div key={field.label} className="flex items-start gap-2">
                <field.icon className="w-3.5 h-3.5 text-gray-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-mono text-gray-600">
                    {field.label}
                  </p>
                  <p className="text-xs text-gray-300">
                    {field.value ?? "Not provided"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-800/60 space-y-2">
            <div className="flex justify-between">
              <span className="text-[10px] font-mono text-gray-600">Plan</span>
              <span className="text-[10px] font-mono text-blue-400">
                {manufacturer.subscriptionPlan}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-mono text-gray-600">Status</span>
              <span className="text-[10px] font-mono text-gray-400">
                {manufacturer.subscriptionStatus}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-mono text-gray-600">NAFDAC</span>
              <span className="text-[10px] font-mono text-gray-400">
                {manufacturer.nafdacNumbers ?? "Not provided"}
              </span>
            </div>
          </div>
        </div>

        {/* Recent batches */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
              Recent Batches
            </h2>
          </div>

          <div className="space-y-2">
            {manufacturer.batches.length === 0 ? (
              <p className="text-xs text-gray-600 font-mono">No batches yet</p>
            ) : (
              manufacturer.batches.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between py-2 border-b border-gray-800/40 last:border-0"
                >
                  <div>
                    <p className="text-xs text-gray-300 font-mono">
                      {batch.batchCode}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {batch.product?.name ?? "No product"} ·{" "}
                      {batch._count.bottles.toLocaleString()} bottles
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-gray-600">
                    {new Date(batch.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active alerts */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
              Active Alerts
            </h2>
            <span className="text-[10px] font-mono text-gray-600">
              {manufacturer._count.alertLogs} total
            </span>
          </div>

          <div className="space-y-2">
            {manufacturer.alertLogs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-gray-600 font-mono">
                  No active alerts
                </p>
              </div>
            ) : (
              manufacturer.alertLogs.map((alert) => {
                const config = SEVERITY_CONFIG[alert.severity]
                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-2 py-2 border-b border-gray-800/40 last:border-0"
                  >
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${config.style}`}
                    >
                      {config.label}
                    </span>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Admin notes */}
      {canEdit && (
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
          <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-4">
            Internal Notes
          </h2>

          <div className="space-y-3 mb-4">
            {manufacturer.adminNotes.length === 0 ? (
              <p className="text-xs text-gray-600 font-mono">No notes yet</p>
            ) : (
              manufacturer.adminNotes.map((note) => (
                <div
                  key={note.id}
                  className="border border-gray-800/60 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-gray-500">
                      {note.authorName}
                    </span>
                    <span className="text-[10px] font-mono text-gray-600">
                      {new Date(note.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300">{note.content}</p>
                </div>
              ))
            )}
          </div>

          <AddNoteForm manufacturerId={id} />
        </div>
      )}
    </div>
  )
}

// ── Advance Stage Form ─────────────────────────────────────────────────────────

function AdvanceStageForm({
  manufacturerId,
  currentStatus,
}: {
  manufacturerId: string
  currentStatus: string
}) {
  const currentIndex = ONBOARDING_STAGES.findIndex(
    (s) => s.key === currentStatus
  )
  const nextStage = ONBOARDING_STAGES[currentIndex + 1]
  if (!nextStage) return null

  return (
    <form
      action={`/api/admin/manufacturers/${manufacturerId}/advance`}
      method="POST"
    >
      <button
        type="submit"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
      >
        Advance to {nextStage.label}
        <ChevronRight className="w-3 h-3" />
      </button>
    </form>
  )
}

// ── Add Note Form ─────────────────────────────────────────────────────────────

function AddNoteForm({ manufacturerId }: { manufacturerId: string }) {
  return (
    <form
      action={`/api/admin/manufacturers/${manufacturerId}/notes`}
      method="POST"
      className="flex gap-2"
    >
      <input
        name="content"
        placeholder="Add an internal note..."
        required
        className="flex-1 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors font-mono"
      >
        Add Note
      </button>
    </form>
  )
}