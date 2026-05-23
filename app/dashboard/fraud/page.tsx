import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatSerialId } from "@/lib/serial"
import { FraudMap } from "@/components/fraud-map"

export default async function FraudPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const [fraudLogs, flaggedBottleCount, driftLogs, scansByRegion] =
    await Promise.all([
      // All fraud scan logs
      prisma.scanLog.findMany({
        where: {
          fraudFlag: true,
          bottle: { batch: { manufacturerId: manufacturer.id } },
        },
        orderBy: { scannedAt: "desc" },
        include: {
          bottle: {
            include: {
              batch: { include: { product: true } },
              scanLogs: { orderBy: { scannedAt: "asc" }, take: 1 },
            },
          },
        },
      }),

      // Total flagged bottles
      prisma.bottle.count({
        where: {
          status: "FLAGGED",
          batch: { manufacturerId: manufacturer.id },
        },
      }),

      // Supply chain drift logs
      prisma.scanLog.findMany({
        where: {
          fraudFlag: true,
          flagReason: { contains: "Supply chain drift" },
          bottle: { batch: { manufacturerId: manufacturer.id } },
        },
        orderBy: { scannedAt: "desc" },
        take: 20,
        include: {
          bottle: {
            include: {
              batch: { include: { product: true } },
            },
          },
        },
      }),

      // All scan logs with coordinates for heat map
      prisma.scanLog.findMany({
        where: {
          lat: { not: null },
          lng: { not: null },
          bottle: { batch: { manufacturerId: manufacturer.id } },
        },
        select: {
          lat: true,
          lng: true,
          fraudFlag: true,
          scannedAt: true,
        },
      }),
    ])

  // Build regional breakdown from Nigerian state coordinates
  const regionBounds: Record<string, { lat: [number, number]; lng: [number, number] }> = {
    Lagos: { lat: [6.3, 6.7], lng: [3.1, 3.7] },
    Abuja: { lat: [8.8, 9.3], lng: [7.1, 7.6] },
    Kano: { lat: [11.8, 12.2], lng: [8.4, 8.7] },
    Rivers: { lat: [4.6, 5.1], lng: [6.8, 7.3] },
    Oyo: { lat: [7.2, 7.6], lng: [3.8, 4.1] },
    Edo: { lat: [6.2, 6.5], lng: [5.5, 5.8] },
    Anambra: { lat: [6.0, 6.4], lng: [6.8, 7.1] },
    Kaduna: { lat: [10.4, 10.7], lng: [7.3, 7.6] },
    Delta: { lat: [5.4, 5.7], lng: [5.7, 6.1] },
  }

  const regionalData = Object.entries(regionBounds).map(([region, bounds]) => {
    const regionScans = scansByRegion.filter(
      (s) =>
        s.lat !== null &&
        s.lng !== null &&
        s.lat >= bounds.lat[0] &&
        s.lat <= bounds.lat[1] &&
        s.lng >= bounds.lng[0] &&
        s.lng <= bounds.lng[1]
    )
    const total = regionScans.length
    const fraud = regionScans.filter((s) => s.fraudFlag).length
    return { region, total, fraud, fraudRate: total > 0 ? (fraud / total) * 100 : 0 }
  }).filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)

  // Format scan points for the map
  const mapPoints = scansByRegion
    .filter((s) => s.lat !== null && s.lng !== null)
    .map((s) => ({
      lat: s.lat!,
      lng: s.lng!,
      fraudFlag: s.fraudFlag,
    }))

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          Fraud Intelligence
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Geographic fraud patterns, supply chain drift, and alert history.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium uppercase tracking-wide">
            Flagged Bottles
          </p>
          <p className="text-3xl font-bold text-red-700 dark:text-red-300 mt-1">
            {flaggedBottleCount.toLocaleString()}
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">
            Fraud Events
          </p>
          <p className="text-3xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {fraudLogs.length.toLocaleString()}
          </p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <p className="text-xs text-orange-600 dark:text-orange-400 font-medium uppercase tracking-wide">
            Drift Alerts
          </p>
          <p className="text-3xl font-bold text-orange-700 dark:text-orange-300 mt-1">
            {driftLogs.length.toLocaleString()}
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">
            Regions Active
          </p>
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">
            {regionalData.length}
          </p>
        </div>
      </div>

      {/* Heat map */}
      {mapPoints.length > 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Geographic Scan Map
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Green = genuine scan · Red = fraud detected
            </p>
          </div>
          <FraudMap points={mapPoints} />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center mb-8">
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            No location data yet. Scans with shared location will appear here.
          </p>
        </div>
      )}

      {/* Regional breakdown table */}
      {regionalData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Regional Breakdown
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {regionalData.map((row) => (
              <div
                key={row.region}
                className="px-6 py-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {row.region}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {row.total} scans
                      </span>
                      {row.fraud > 0 && (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">
                          {row.fraud} fraud
                        </span>
                      )}
                      <span
                        className={`text-xs font-bold w-10 text-right ${
                          row.fraudRate > 20
                            ? "text-red-600 dark:text-red-400"
                            : row.fraudRate > 5
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {row.fraudRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 relative overflow-hidden"
                      style={{ width: "100%" }}
                    >
                      <div
                        className="absolute left-0 top-0 h-full bg-red-500 rounded-full"
                        style={{ width: `${Math.min(row.fraudRate, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supply chain drift alerts */}
      {driftLogs.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-orange-200 dark:border-orange-800 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
            <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-200">
              Supply Chain Drift Alerts
            </h3>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
              Batches scanned outside their intended distribution region
            </p>
          </div>
          <div className="divide-y divide-orange-100 dark:divide-orange-900">
            {driftLogs.map((log) => (
              <div key={log.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {log.bottle?.batch?.product?.name ?? "Unknown product"}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      {log.flagReason}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {new Date(log.scannedAt).toLocaleDateString("en-NG", {
                      timeZone: "Africa/Lagos",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {log.lat && log.lng && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                    Scanned at {log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fraud alert history */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Fraud Alert History
          </h3>
        </div>

        {fraudLogs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              No fraud detected
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              All scans are looking clean.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {fraudLogs.map((log) => {
              if (!log.bottle) return null
              return (
                <div key={log.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg shrink-0">🚨</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {log.bottle.batch.product?.name ?? "No Product"}
                        </p>
                        <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5">
                          {formatSerialId(log.bottle.serialId)}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {log.flagReason ?? "Duplicate scan"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
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