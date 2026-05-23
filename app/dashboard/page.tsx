import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatSerialId } from "@/lib/serial"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const [
    totalBottles,
    totalScans,
    fraudScans,
    genuineScans,
    recentScans,
  ] = await Promise.all([
    // Total bottles generated
    prisma.bottle.count({
      where: { batch: { manufacturerId: manufacturer.id } },
    }),

    // Total scan events (all layers)
    prisma.scanLog.count({
      where: { bottle: { batch: { manufacturerId: manufacturer.id } } },
    }),

    // Fraud scan events
    prisma.scanLog.count({
      where: {
        fraudFlag: true,
        bottle: { batch: { manufacturerId: manufacturer.id } },
      },
    }),

    // Genuine = CAP layer scans that are not fraud (completed verifications)
    prisma.scanLog.count({
      where: {
        fraudFlag: false,
        scanLayer: "CAP",
        bottle: { batch: { manufacturerId: manufacturer.id } },
      },
    }),

    // Recent scan activity
    prisma.scanLog.findMany({
      where: { bottle: { batch: { manufacturerId: manufacturer.id } } },
      orderBy: { scannedAt: "desc" },
      take: 5,
      include: {
        bottle: {
          include: {
            batch: { include: { product: true } },
          },
        },
      },
    }),
  ])

  const fraudRate =
    totalScans > 0 ? ((fraudScans / totalScans) * 100).toFixed(1) : "0.0"

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Welcome back, {manufacturer.companyName}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Bottles" value={totalBottles.toLocaleString()} />
        <StatCard label="Total Scans" value={totalScans.toLocaleString()} />
        <StatCard label="Verified Genuine" value={genuineScans.toLocaleString()} />
        <StatCard
          label="Fraud Rate"
          value={`${fraudRate}%`}
          highlight={parseFloat(fraudRate) > 5}
        />
      </div>

      {/* Bottle status breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Unopened",
            status: "MINT",
            color: "text-green-600 dark:text-green-400",
            bg: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
          },
          {
            label: "Opened",
            status: "OPENED",
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
          },
          {
            label: "Flagged",
            status: "FLAGGED",
            color: "text-red-600 dark:text-red-400",
            bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
          },
        ].map(async (item) => {
          const count = await prisma.bottle.count({
            where: {
              status: item.status as "MINT" | "OPENED" | "FLAGGED",
              batch: { manufacturerId: manufacturer.id },
            },
          })
          return (
            <div
              key={item.status}
              className={`rounded-xl border p-4 ${item.bg}`}
            >
              <p className={`text-xs font-medium uppercase tracking-wide ${item.color}`}>
                {item.label}
              </p>
              <p className={`text-3xl font-bold mt-1 ${item.color}`}>
                {count.toLocaleString()}
              </p>
            </div>
          )
        })}
      </div>

      {/* Recent activity */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Recent Scans
          </h3>
          <a
            href="/dashboard/scans"
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            View all
          </a>
        </div>

        {recentScans.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No scans yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentScans.map((log) => {
              if (!log.bottle) return null
              return (
                <div
                  key={log.id}
                  className="px-6 py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 w-2 h-2 rounded-full ${
                      log.fraudFlag ? "bg-red-500" : "bg-green-400"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {log.bottle.batch.product?.name ?? "No Product"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                          {formatSerialId(log.bottle.serialId)}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          log.scanLayer === "CAP"
                            ? "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        }`}>
                          {log.scanLayer}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {log.fraudFlag && (
                      <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">
                        Fraud
                      </span>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(log.scannedAt).toLocaleDateString("en-NG", {
                        timeZone: "Africa/Lagos",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-3xl font-bold mt-2 ${
        highlight ? "text-red-500" : "text-gray-900 dark:text-white"
      }`}>
        {value}
      </p>
    </div>
  )
}