import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatSerialId } from "@/lib/serial"

const ITEMS_PER_PAGE = 20

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>
}) {
  const { page, filter } = await searchParams
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const currentPage = parseInt(page ?? "1", 10)
  const skip = (currentPage - 1) * ITEMS_PER_PAGE

  const baseWhere = {
    bottle: { batch: { manufacturerId: manufacturer.id } },
  }

  const filterWhere =
    filter === "fraud"
      ? { ...baseWhere, fraudFlag: true }
      : filter === "genuine"
      ? { ...baseWhere, fraudFlag: false, scanLayer: "CAP" as const }
      : filter === "bottle"
      ? { ...baseWhere, scanLayer: "BOTTLE" as const }
      : filter === "cap"
      ? { ...baseWhere, scanLayer: "CAP" as const }
      : baseWhere

  const [scanLogs, totalCount] = await Promise.all([
    prisma.scanLog.findMany({
      where: filterWhere,
      orderBy: { scannedAt: "desc" },
      skip,
      take: ITEMS_PER_PAGE,
      include: {
        bottle: {
          include: {
            batch: { include: { product: true } },
          },
        },
      },
    }),
    prisma.scanLog.count({ where: filterWhere }),
  ])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const filters = [
    { label: "All", value: "" },
    { label: "Genuine", value: "genuine" },
    { label: "Fraud", value: "fraud" },
    { label: "Bottle Layer", value: "bottle" },
    { label: "Cap Layer", value: "cap" },
  ]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          Scan Logs
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Every verification event across all your products.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {filters.map((f) => (
          <a
            key={f.value}
            href={`/dashboard/scans?filter=${f.value}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              (filter ?? "") === f.value
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {totalCount.toLocaleString()} total scans
          </p>
        </div>

        {scanLogs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No scans found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {scanLogs.map((log) => {
              if (!log.bottle) return null
              return (
                <div key={log.id} className="px-4 md:px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`mt-1 shrink-0 w-2 h-2 rounded-full ${
                        log.fraudFlag ? "bg-red-500" : "bg-green-400"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {log.bottle.batch.product?.name ?? "No Product"}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                          {formatSerialId(log.bottle.serialId)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {log.fraudFlag && (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">
                          Fraud
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        log.scanLayer === "CAP"
                          ? "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                      }`}>
                        {log.scanLayer}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 ml-5 flex flex-wrap gap-x-4 gap-y-1">
<span className="text-xs text-gray-400 dark:text-gray-500">
  {log.scanLayer === "BOTTLE" ? "Bottle Scan" : "Cap Scan"}
</span>
                    {log.lat && log.lng && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {log.lat.toFixed(2)}, {log.lng.toFixed(2)}
                      </span>
                    )}
                    {log.flagReason && (
                      <span className="text-xs text-red-500 dark:text-red-400">
                        {log.flagReason}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(log.scannedAt).toLocaleDateString("en-NG", {
                        timeZone: "Africa/Lagos",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <a
                  href={`/dashboard/scans?page=${currentPage - 1}&filter=${filter ?? ""}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 transition-colors"
                >
                  Previous
                </a>
              )}
              {currentPage < totalPages && (
                <a
                  href={`/dashboard/scans?page=${currentPage + 1}&filter=${filter ?? ""}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 transition-colors"
                >
                  Next
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}