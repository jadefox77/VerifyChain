import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatSerialId } from "@/lib/serial"

const ITEMS_PER_PAGE = 20

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const { page, status } = await searchParams
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const currentPage = parseInt(page ?? "1", 10)
  const skip = (currentPage - 1) * ITEMS_PER_PAGE

  const statusFilter = status === "FLAGGED" || status === "OPENED" || status === "MINT"
    ? status
    : undefined

  const where = {
    bottle: {
      batch: { manufacturerId: manufacturer.id },
      ...(statusFilter ? { status: statusFilter } : {}),
    },
  }

  const [scanLogs, totalCount] = await Promise.all([
    prisma.scanLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: ITEMS_PER_PAGE,
      include: {
        bottle: {
          include: {
            batch: {
              include: { product: true },
            },
          },
        },
      },
    }),
    prisma.scanLog.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Scan Logs</h2>
        <p className="text-gray-500 text-sm mt-1">
          Every verification event across all your products.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { label: "All", value: "" },
          { label: "Opened", value: "OPENED" },
          { label: "Flagged", value: "FLAGGED" },
          { label: "Mint", value: "MINT" },
        ].map((filter) => (
          <a
            key={filter.value}
            href={`/dashboard/scans?status=${filter.value}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              (status ?? "") === filter.value
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {filter.label}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">
            {totalCount.toLocaleString()} total scans
          </p>
        </div>

        {scanLogs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">No scans found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {scanLogs.map((log) => (
              <div
                key={log.id}
                className="px-6 py-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className={`shrink-0 w-2 h-2 rounded-full ${
                    log.fraudFlag
                      ? "bg-red-500"
                      : log.bottle.status === "OPENED"
                      ? "bg-blue-400"
                      : "bg-green-400"
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {log.bottle.batch.product.name}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      {formatSerialId(log.bottle.serialId)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  {log.fraudFlag && (
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      Fraud
                    </span>
                  )}
                  {log.lat && log.lng && (
                    <p className="text-xs text-gray-400 hidden md:block">
                      {log.lat.toFixed(2)}, {log.lng.toFixed(2)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    Scan #{log.scanCount}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <a
                  href={`/dashboard/scans?page=${currentPage - 1}&status=${status ?? ""}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
                >
                  Previous
                </a>
              )}
              {currentPage < totalPages && (
                <a
                  href={`/dashboard/scans?page=${currentPage + 1}&status=${status ?? ""}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
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