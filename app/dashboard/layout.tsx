import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      <Sidebar
        email={session.user?.email ?? ""}
        signOutAction={handleSignOut}
      />
      <main className="flex-1 p-4 md:p-8 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  )
}