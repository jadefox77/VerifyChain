import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/sidebar"

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | VerifyChain",
  },
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  if (session.user.mustResetPassword) redirect("/auth/reset-password")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
    select: { onboardingStatus: true, companyName: true },
  })

  // No manufacturer record yet
  if (!manufacturer) redirect("/onboarding")

  // Registered but not yet approved
  if (manufacturer.onboardingStatus !== "ACTIVE_PRODUCTION") redirect("/onboarding/pending")

  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:flex dark:bg-gray-950">
      <Sidebar
        email={session.user.email ?? ""}
        companyName={manufacturer.companyName}
        signOutAction={handleSignOut}
      />
      <main id="main" className="min-w-0 flex-1 px-4 pb-12 pt-20 sm:px-6 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
