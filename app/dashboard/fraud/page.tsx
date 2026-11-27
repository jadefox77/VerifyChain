import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/workspace"
import type { Metadata } from "next"
import { MapPin, ShieldCheck } from "lucide-react"
import { formatSerialId } from "@/lib/serial-format"
import { FraudMap } from "@/components/fraud-map"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { card, cardHeader, cardTitle } from "@/lib/ui"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = { title: "Fraud alerts" }

export default async function FraudPage() {
  const { manufacturer } = await requireWorkspace("viewFraud")

  const [fraudLogs, fraudLogCount, flaggedBottleCount, driftLogs, scansByRegion] =
    await Promise.all([
      // All fraud scan logs
      prisma.scanLog.findMany({
        where: {
          fraudFlag: true,
          bottle: { batch: { manufacturerId: manufacturer.id } },
        },
        orderBy: { scannedAt: "desc" },
        take: 100,
        include: {
          bottle: {
            include: {
              batch: { include: { product: true } },
            },
          },
        },
      }),

      prisma.scanLog.count({
        where: {
          fraudFlag: true,
          bottle: { batch: { manufacturerId: manufacturer.id } },
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

  // Regional breakdown from approximate state bounding boxes
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
    <div className="space-y-8">
      <PageHeader
        title="Fraud alerts"
        description="Scans that failed a check, where they happened, and batches turning up outside their target state."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Flagged units" value={flaggedBottleCount.toLocaleString()} tone={flaggedBottleCount > 0 ? "bad" : "neutral"} />
        <StatCard label="Flagged scans" value={fraudLogCount.toLocaleString()} tone={fraudLogCount > 0 ? "warn" : "neutral"} />
        <StatCard label="Out-of-region scans" value={driftLogs.length.toLocaleString()} hint="Latest 20 shown below" />
        <StatCard label="States with scans" value={regionalData.length} hint="Where location was shared" />
      </div>

      <section className={card}>
        <div className={cardHeader}>
          <div>
            <h2 className={cardTitle}>Scan map</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Only scans where the shopper shared their location.</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden="true" /> Genuine
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" /> Flagged
            </span>
          </div>
        </div>
        {mapPoints.length > 0 ? (
          <FraudMap points={mapPoints} />
        ) : (
          <EmptyState
            icon={MapPin}
            title="No location data yet"
            description="Shoppers are asked to share their location when they verify. Scans where they agree will appear on this map."
          />
        )}
      </section>

      {regionalData.length > 0 && (
        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>By state</h2>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {regionalData.map((row) => (
              <li key={row.region} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{row.region}</p>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{row.total.toLocaleString()} scans</span>
                    {row.fraud > 0 && <Badge tone="bad">{row.fraud} flagged</Badge>}
                    <span
                      className={`w-12 text-right font-semibold tabular-nums ${
                        row.fraudRate > 20
                          ? "text-red-600 dark:text-red-400"
                          : row.fraudRate > 5
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {row.fraudRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(row.fraudRate, 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {driftLogs.length > 0 && (
        <section className={card}>
          <div className={cardHeader}>
            <div>
              <h2 className={cardTitle}>Scanned outside the target state</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Units scanned more than 300 km from where their batch was meant to be sold.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {driftLogs.map((log) => (
              <li key={log.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {log.bottle?.batch?.product?.name ?? "Unknown product"}
                  </p>
                  <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">{log.flagReason}</p>
                  {log.lat != null && log.lng != null && (
                    <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{formatDate(log.scannedAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <div className={cardHeader}>
          <h2 className={cardTitle}>Flagged scans</h2>
          {fraudLogCount > fraudLogs.length && (
            <span className="text-xs text-gray-500 dark:text-gray-400">Latest {fraudLogs.length} of {fraudLogCount.toLocaleString()}</span>
          )}
        </div>
        {fraudLogs.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No flagged scans"
            description="None of your products have failed a check so far."
          />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {fraudLogs.map((log) => {
              if (!log.bottle) return null
              return (
                <li key={log.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {log.bottle.batch.product?.name ?? "No product"}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {formatSerialId(log.bottle.serialId)} · {log.scanLayer === "CAP" ? "Cap" : "Label"}
                    </p>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">{log.flagReason ?? "Repeat scan"}</p>
                  </div>
                  <p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{formatDate(log.scannedAt, true)}</p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
