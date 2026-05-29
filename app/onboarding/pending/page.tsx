import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Clock, CheckCircle2, Circle } from "lucide-react"
import { handleSignOut } from "@/lib/actions/auth"

const STAGE_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Pending Review",
  COMPLIANCE_VERIFICATION: "Compliance Verification",
  TECHNICAL_INTEGRATION: "Technical Integration",
  PILOT_APPROVAL: "Pilot Approval",
  ACTIVE_PRODUCTION: "Active Production",
  REJECTED: "Application Rejected",
  SUSPENDED: "Account Suspended",
}

const STAGE_ORDER = [
  "PENDING_REVIEW",
  "COMPLIANCE_VERIFICATION",
  "TECHNICAL_INTEGRATION",
  "PILOT_APPROVAL",
  "ACTIVE_PRODUCTION",
]

const STAGE_DESCRIPTIONS: Record<string, string> = {
  PENDING_REVIEW:
    "Your application has been received and is awaiting review by the VerifyChain team.",
  COMPLIANCE_VERIFICATION:
    "We are verifying your RC number and NAFDAC registrations.",
  TECHNICAL_INTEGRATION:
    "Your API access is being configured. Our technical team may contact you.",
  PILOT_APPROVAL:
    "A test batch is running. We are validating your integration before full activation.",
  ACTIVE_PRODUCTION:
    "Your account is fully active. You can now access your dashboard.",
}

export default async function OnboardingPendingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
    select: {
      companyName: true,
      onboardingStatus: true,
      createdAt: true,
    },
  })

  if (!manufacturer) redirect("/onboarding")
  if (manufacturer.onboardingStatus === "ACTIVE_PRODUCTION") {
    redirect("/dashboard")
  }

  const currentStageIndex = STAGE_ORDER.indexOf(
    manufacturer.onboardingStatus
  )

  const isRejected = manufacturer.onboardingStatus === "REJECTED"
  const isSuspended = manufacturer.onboardingStatus === "SUSPENDED"

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-white">
            Application In Progress
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {manufacturer.companyName}
          </p>
        </div>

        {/* Rejected or suspended */}
        {(isRejected || isSuspended) && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
            <p className="text-sm font-semibold text-red-400">
              {isRejected
                ? "Application Rejected"
                : "Account Suspended"}
            </p>
            <p className="text-xs text-red-400/70 mt-1">
              Please contact{" "}
              <a
                href="mailto:support@verifychain.africa"
                className="underline"
              >
                support@verifychain.africa
              </a>{" "}
              for more information.
            </p>
          </div>
        )}

        {/* Progress stages */}
        {!isRejected && !isSuspended && (
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              Onboarding Progress
            </h2>
            <div className="space-y-3">
              {STAGE_ORDER.map((stage, i) => {
                const isDone = i < currentStageIndex
                const isCurrent = i === currentStageIndex

                return (
                  <div key={stage} className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : isCurrent ? (
                        <div className="w-4 h-4 rounded-full border-2 border-blue-400 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        </div>
                      ) : (
                        <Circle className="w-4 h-4 text-gray-700" />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          isDone
                            ? "text-green-400"
                            : isCurrent
                            ? "text-blue-400"
                            : "text-gray-600"
                        }`}
                      >
                        {STAGE_LABELS[stage]}
                      </p>
                      {isCurrent && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {STAGE_DESCRIPTIONS[stage]}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Info + sign out */}
        <div className="text-center space-y-2">
          {!isRejected && !isSuspended && (
            <>
              <p className="text-xs text-gray-600">
                Submitted{" "}
                {new Date(manufacturer.createdAt).toLocaleDateString(
                  "en-NG",
                  {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }
                )}
              </p>
              <p className="text-xs text-gray-600">
                Questions?{" "}
                <a
                  href="mailto:support@verifychain.africa"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  support@verifychain.africa
                </a>
              </p>
            </>
          )}

          <div className="pt-4 border-t border-gray-800/60">
            <form action={handleSignOut}>
              <button
                type="submit"
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Sign out and use a different account
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}