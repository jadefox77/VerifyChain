import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; layer?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const params = await searchParams
  const filter = params.filter ?? "ALL"
  const layer = params.layer ?? "ALL"

  const where = {
    manufacturerId: manufacturer.id,
    ...(filter === "GENUINE" ? { fraudFlag: false } : {}),
    ...(filter === "FRAUD" ? { fraudFlag: true } : {}),
    ...(layer === "BOTTLE" ? { scanLayer: "BOTTLE" as const } : {}),
    ...(layer === "CAP" ? { scanLayer: "CAP" as const } : {}),
  }

  const logs = await prisma.scanLog.findMany({
    where,
    orderBy: { scannedAt: "desc" },
    take: 100,
    include: {
      bottle: {
        include: {
          batch: {
            include: {
              product: { select: { name: true, authMode: true } },
            },
          },
        },
      },
    },
  })

  const FILTER_TABS = [
    { key: "ALL", label: "All" },
    { key: "GENUINE", label: "Genuine" },
    { key: "FRAUD", label: "Fraud" },
  ]

  const LAYER_TABS = [
    { key: "ALL", label: "All Layers" },
    { key: "BOTTLE", label: "Bottle" },
    { key: "CAP", label: "Cap" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Scan Logs
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          All verification events for your products.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {FILTER_TABS.map((tab) => (
            <a
              key={tab.key}
              href={`/dashboard/scans?filter=${tab.key}&layer=${layer}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === tab.key
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {LAYER_TABS.map((tab) => (
            <a
              key={tab.key}
              href={`/dashboard/scans?filter=${filter}&layer=${tab.key}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                layer === tab.key
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>

        <span className="text-xs text-gray-400 font-mono ml-1">
          {logs.length} results
        </span>
      </div>

      {/* Scan log table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              {[
                "Time",
                "Product",
                "Layer",
                "Channel",
                "Location",
                "Result",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No scan logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isPaired =
                  log.bottle?.batch?.product?.authMode === "PAIRED"

                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${
                      log.fraudFlag
                        ? "bg-red-50/50 dark:bg-red-500/5"
                        : ""
                    }`}
                  >
                    {/* Time */}
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono text-gray-600 dark:text-gray-400">
                        {new Date(log.scannedAt).toLocaleDateString(
                          "en-NG",
                          {
                            day: "numeric",
                            month: "short",
                          }
                        )}
                      </p>
                      <p className="text-[10px] font-mono text-gray-400">
                        {new Date(log.scannedAt).toLocaleTimeString(
                          "en-NG",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Africa/Lagos",
                          }
                        )}
                      </p>
                    </td>

                    {/* Product */}
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        {log.bottle?.batch?.product?.name ??
                          "Unknown"}
                      </p>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                          isPaired
                            ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                            : "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20"
                        }`}
                      >
                        {isPaired ? "Paired" : "Single"}
                      </span>
                    </td>

                    {/* Layer */}
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          log.scanLayer === "BOTTLE"
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                            : "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                        }`}
                      >
                        {log.scanLayer}
                      </span>
                    </td>

                    {/* Channel */}
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono text-gray-500">
                        {log.channel === "whatsapp" ? (
                          <span className="text-green-600 dark:text-green-400">
                            WhatsApp
                          </span>
                        ) : log.channel ? (
                          log.channel
                        ) : (
                          "Direct QR"
                        )}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {log.region ?? "—"}
                      </span>
                    </td>

                    {/* Result */}
                    <td className="px-4 py-3">
                      {log.fraudFlag ? (
                        <div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20">
                            Fraud
                          </span>
                          {log.flagReason && (
                            <p className="text-[9px] text-red-400 mt-0.5 max-w-[140px] truncate">
                              {log.flagReason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20">
                          Genuine
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}