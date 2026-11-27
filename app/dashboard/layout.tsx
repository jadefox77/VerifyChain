import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth, signOut } from "@/lib/auth"
import { requireWorkspace } from "@/lib/workspace"
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

  // Owner or team member, with role and company read from the database (not
  // the login token, which can be up to 7 days old). Redirects anyone who
  // cannot use the dashboard.
  const { manufacturer, role } = await requireWorkspace()

  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:flex dark:bg-gray-950">
      <Sidebar
        email={session.user.email ?? ""}
        companyName={manufacturer.companyName}
        role={role}
        signOutAction={handleSignOut}
      />
      <main id="main" className="min-w-0 flex-1 px-4 pb-12 pt-20 sm:px-6 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
