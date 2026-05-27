import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { prisma } from "@/lib/prisma"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")


  if (session.user.mustResetPassword) {
  redirect("/auth/reset-password")
}


  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
    select: { onboardingStatus: true },
  })

  // No manufacturer record yet
  if (!manufacturer) redirect("/onboarding")

  // Manufacturer exists but not yet approved
  if (manufacturer.onboardingStatus !== "ACTIVE_PRODUCTION") {
    redirect("/onboarding/pending")
  }

  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 lg:flex">
      <Sidebar
        email={session.user?.email ?? ""}
        signOutAction={handleSignOut}
      />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0 p-4 md:p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}