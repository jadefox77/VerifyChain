import { auth, signOut } from "@/lib/auth"
import { requireAdmin } from "@/lib/admin-auth"
import { AdminSidebar } from "@/components/admin/sidebar"
import { prisma } from "@/lib/prisma"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdmin()

  const alertCount = await prisma.alertLog.count({
    where: {
      resolved: false,
      severity: { in: ["HIGH_CONCERN", "CRITICAL"] },
    },
  })

  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <AdminSidebar
        userRole={session.user.role}
        alertCount={alertCount}
        signOutAction={handleSignOut}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 border-b border-gray-800/60 flex items-center justify-between px-6 shrink-0 bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">
              VerifyChain Africa — Operational Intelligence
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono text-gray-600">
              {new Date().toISOString().split("T")[0]}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  )
}