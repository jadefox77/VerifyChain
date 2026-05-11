import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { signOut } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) redirect("/login")

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="font-bold text-gray-900">VerifyChain</h1>
          <p className="text-xs text-gray-500 mt-1 truncate">{session.user?.email}</p>
        </div>

       <nav className="flex-1 p-4 flex flex-col gap-1">
  <a href="/dashboard" className="px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
    Overview
  </a>
  <a href="/dashboard/batches" className="px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
    Batches
  </a>
  <a href="/dashboard/scans" className="px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
    Scan Logs
  </a>
  <a href="/dashboard/fraud" className="px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
    Fraud Alerts
  </a>
  <a href="/dashboard/products" className="px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
    Products
  </a>
</nav>
        <div className="p-4 border-t border-gray-200">
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <button
              type="submit"
              className="w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors text-left"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}