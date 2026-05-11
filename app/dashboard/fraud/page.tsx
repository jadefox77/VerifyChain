import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatSerialId } from "@/lib/serial"

export default async function FraudPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const fraudLogs = await prisma.scanLog.findMany({
    where: {
      fraudFlag: true,
      bottle: {
        batch: { manufacturerId: manufacturer.id },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      bottle: {
        include: {
          batch: {
            include: { product: true },
          },
          scanLogs: {
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
    },
  })

  const flaggedBottleCount = await prisma.bottle.count({
    where: {
      status: "FLAGGED",
      batch: { manufacturerId: manufacturer.id },
    },
  })

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold dark:text-white dark:text-white">Fraud Alerts</h2>
        <p className="dark:dark:text-gray-500 text-sm mt-1">
          All verification events flagged as suspicious.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-xs text-red-600 font-medium uppercase tracking-wide">
            Flagged Bottles
          </p>
          <p className="text-3xl font-bold text-red-700 mt-1">
            {flaggedBottleCount.toLocaleString()}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">
            Fraud Events
          </p>
          <p className="text-3xl font-bold text-amber-700 mt-1">
            {fraudLogs.length.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Fraud log list */}
      {fraudLogs.length === 0 ? (
        <div className="dark:bg-gray-900 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="dark:dark:text-gray-500 text-sm font-medium">No fraud detected</p>
          <p className="dark:text-gray-500 text-xs mt-1">
            All scans are looking clean.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {fraudLogs.map((log) => (
            <FraudCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  )
}

type FraudLog = {
  id: string
  flagReason: string | null
  lat: number | null
  lng: number | null
  scanCount: number
  createdAt: Date
  bottle: {
    serialId: string
    firstScannedAt: Date | null
    firstScannedLat: number | null
    firstScannedLng: number | null
    batch: {
      product: { name: string }
    }
    scanLogs: { createdAt: Date }[]
  }
}

function FraudCard({ log }: { log: FraudLog }) {
  const firstScanTime = log.bottle.firstScannedAt
  const currentScanTime = log.createdAt

  let distanceKm: number | null = null
  if (
    log.bottle.firstScannedLat &&
    log.bottle.firstScannedLng &&
    log.lat &&
    log.lng
  ) {
    const R = 6371
    const dLat =
      ((log.lat - log.bottle.firstScannedLat) * Math.PI) / 180
    const dLng =
      ((log.lng - log.bottle.firstScannedLng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((log.bottle.firstScannedLat * Math.PI) / 180) *
        Math.cos((log.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  return (
    <div className="dark:bg-gray-900 dark:bg-gray-900 rounded-xl border border-red-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">🚨</span>
          <p className="text-sm font-semibold text-red-800">
            {log.bottle.batch.product.name}
          </p>
        </div>
        <span className="font-mono text-xs text-red-600">
          {formatSerialId(log.bottle.serialId)}
        </span>
      </div>

      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs dark:text-gray-500 mb-1">Reason</p>
          <p className="text-sm font-medium dark:text-white dark:text-white">
            {log.flagReason ?? "Duplicate scan"}
          </p>
        </div>
        <div>
          <p className="text-xs dark:text-gray-500 mb-1">Scan number</p>
          <p className="text-sm font-medium dark:text-white dark:text-white">
            #{log.scanCount}
          </p>
        </div>
        {distanceKm !== null && (
          <div>
            <p className="text-xs dark:text-gray-500 mb-1">Distance from first scan</p>
            <p className="text-sm font-medium dark:text-white dark:text-white">
              {distanceKm.toLocaleString()} km
            </p>
          </div>
        )}
        <div>
          <p className="text-xs dark:text-gray-500 mb-1">Flagged at</p>
          <p className="text-sm font-medium dark:text-white dark:text-white">
            {new Date(currentScanTime).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {firstScanTime && (
        <div className="px-5 py-3 dark:bg-gray-950 border-t border-gray-100">
          <p className="text-xs dark:text-gray-500">
            First opened:{" "}
            <span className="text-gray-600 font-medium">
              {new Date(firstScanTime).toLocaleString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {log.bottle.firstScannedLat && (
              <span className="ml-3">
                at {log.bottle.firstScannedLat.toFixed(2)},{" "}
                {log.bottle.firstScannedLng?.toFixed(2)}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}