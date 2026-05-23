import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { OnboardingForm } from "@/components/onboarding/onboarding-form"
import { Shield } from "lucide-react"

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const existing = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })

  if (existing) redirect("/dashboard")

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Register Your Company
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Complete all steps to apply for VerifyChain Africa access.
            Your application will be reviewed before activation.
          </p>
        </div>

        <OnboardingForm
          userEmail={session.user.email ?? ""}
          userName={session.user.name ?? ""}
        />
      </div>
    </main>
  )
}