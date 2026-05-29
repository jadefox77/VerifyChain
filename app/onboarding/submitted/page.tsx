import { CheckCircle2, Clock } from "lucide-react"
import { handleSignOut } from "@/lib/actions/auth"

export default function OnboardingSubmittedPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          Application Submitted
        </h1>

        <p className="text-gray-400 text-sm mb-6">
          Your application is now under review by the VerifyChain team.
          You will be notified once your account is approved and
          activated.
        </p>

        <div className="flex items-center justify-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg mb-6">
          <Clock className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-400">
            Status: <strong>Pending Review</strong> — typically 1–3
            business days
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            You will receive confirmation once your account is approved.
          </p>
          <p className="text-xs text-gray-500">
            Questions?{" "}
            <a
              href="mailto:support@verifychain.africa"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              support@verifychain.africa
            </a>
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-800/40">
          <form action={handleSignOut}>
            <button
              type="submit"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}