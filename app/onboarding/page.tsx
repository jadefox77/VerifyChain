import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleSignOut } from "@/lib/actions/auth"
import { OnboardingForm } from "@/components/onboarding/onboarding-form"
import { AuthShell } from "@/components/ui/auth-shell"

export const metadata: Metadata = {
  title: "Register your company",
}

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Owners who already registered, and team members of another company,
  // do not register a company here.
  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { teamManufacturerId: true, manufacturer: { select: { id: true } } },
  })
  if (existing?.manufacturer || existing?.teamManufacturerId) redirect("/dashboard")

  return (
    <AuthShell
      width="lg"
      footer={
        <span className="inline-flex flex-wrap items-center justify-center gap-x-2">
          <span>Signed in as {session.user.email}</span>
          <span aria-hidden="true">·</span>
          <form action={handleSignOut} className="inline">
            <button type="submit" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200">
              Sign out
            </button>
          </form>
        </span>
      }
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Register your company
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          This takes about five minutes. We review every application before a
          manufacturer can issue codes, and you can save time by having your RC
          number and NAFDAC registrations to hand.
        </p>
      </div>
      <OnboardingForm userEmail={session.user.email ?? ""} userName={session.user.name ?? ""} />
    </AuthShell>
  )
}
