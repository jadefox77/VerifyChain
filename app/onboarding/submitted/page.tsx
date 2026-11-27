import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { handleSignOut } from "@/lib/actions/auth"
import { AuthCard, AuthShell } from "@/components/ui/auth-shell"
import { buttonPrimary } from "@/lib/ui"

export const metadata: Metadata = {
  title: "Application submitted",
}

export default function OnboardingSubmittedPage() {
  return (
    <AuthShell
      width="md"
      footer={
        <form action={handleSignOut}>
          <button type="submit" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200">
            Sign out
          </button>
        </form>
      }
    >
      <AuthCard>
        <CheckCircle2 className="h-10 w-10 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Application submitted
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Thank you. Our team will review your details and may contact you if we
          need anything else. Sign in at any time to see which stage your
          application has reached.
        </p>
        <Link href="/onboarding/pending" className={`${buttonPrimary} mt-6 w-full`}>
          View application status
        </Link>
        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Questions? Email{" "}
          <a href="mailto:support@verifychain.africa" className="font-medium text-gray-700 underline underline-offset-2 dark:text-gray-300">
            support@verifychain.africa
          </a>
        </p>
      </AuthCard>
    </AuthShell>
  )
}
