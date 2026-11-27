import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Check } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleSignOut } from "@/lib/actions/auth"
import { AuthCard, AuthShell, Notice } from "@/components/ui/auth-shell"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = {
  title: "Application status",
}

const STAGES = [
  {
    key: "PENDING_REVIEW",
    label: "Application received",
    description: "Our team is reviewing the details you submitted.",
  },
  {
    key: "COMPLIANCE_VERIFICATION",
    label: "Compliance check",
    description: "We are confirming your CAC registration and NAFDAC numbers.",
  },
  {
    key: "TECHNICAL_INTEGRATION",
    label: "Account setup",
    description: "We are setting up your account and any factory scanner access. Our team may contact your technical lead.",
  },
  {
    key: "PILOT_APPROVAL",
    label: "Pilot batch",
    description: "A test batch is being run to confirm printing and scanning work on your line.",
  },
  {
    key: "ACTIVE_PRODUCTION",
    label: "Live",
    description: "Your dashboard is open.",
  },
]

const SUPPORT = "support@verifychain.africa"

export default async function OnboardingPendingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
    select: { companyName: true, onboardingStatus: true, createdAt: true },
  })

  if (!manufacturer) redirect("/onboarding")
  if (manufacturer.onboardingStatus === "ACTIVE_PRODUCTION") redirect("/dashboard")

  const isRejected = manufacturer.onboardingStatus === "REJECTED"
  const isSuspended = manufacturer.onboardingStatus === "SUSPENDED"
  const current = STAGES.findIndex((s) => s.key === manufacturer.onboardingStatus)

  return (
    <AuthShell
      width="md"
      footer={
        <form action={handleSignOut}>
          <button type="submit" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200">
            Sign out or use a different account
          </button>
        </form>
      }
    >
      <AuthCard>
        <p className="text-sm text-gray-500 dark:text-gray-400">{manufacturer.companyName}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {isRejected
            ? "Your application was not approved"
            : isSuspended
              ? "Your account is suspended"
              : "Your application is in review"}
        </h1>

        {isRejected || isSuspended ? (
          <div className="mt-5">
            <Notice tone="error">
              {isRejected
                ? "We were not able to approve this application. "
                : "Access to your dashboard has been paused. "}
              Email{" "}
              <a href={`mailto:${SUPPORT}`} className="font-medium underline underline-offset-2">
                {SUPPORT}
              </a>{" "}
              and we will explain the next steps.
            </Notice>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Submitted on {formatDate(manufacturer.createdAt)}. This page updates
              as your application moves through each stage.
            </p>
            <ol className="mt-6 space-y-0">
              {STAGES.map((stage, i) => {
                const done = i < current
                const active = i === current
                return (
                  <li key={stage.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={active ? "step" : undefined}>
                    {i < STAGES.length - 1 && (
                      <span
                        className={`absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px ${
                          done ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-800"
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        done
                          ? "bg-brand-600 text-white dark:bg-brand-500 dark:text-gray-950"
                          : active
                            ? "border-2 border-brand-600 bg-white text-brand-700 dark:border-brand-400 dark:bg-gray-900 dark:text-brand-300"
                            : "border border-gray-300 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                    </span>
                    <div className="pt-0.5">
                      <p
                        className={`text-sm font-medium ${
                          active ? "text-gray-900 dark:text-white" : done ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {stage.label}
                        {active && <span className="sr-only"> (current stage)</span>}
                      </p>
                      {active && <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{stage.description}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
            <p className="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
              Questions about your application? Email{" "}
              <a href={`mailto:${SUPPORT}`} className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-400">
                {SUPPORT}
              </a>
              .
            </p>
          </>
        )}
      </AuthCard>
    </AuthShell>
  )
}
