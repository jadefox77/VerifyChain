import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import {
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Activity,
  Clock,
} from "lucide-react"
import Link from "next/link"

export const revalidate = 30

async function getPairingMetrics() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Batch 1
  const [
    totalPairedBottles,
    totalUnpairedBottles,
    totalFlaggedCaps,
  ] = await Promise.all([
    prisma.bottle.count({ where: { cap: { isNot: null } } }),
    prisma.bottle.count({
      where: {
        cap: null,
        batch: { product: { authMode: "PAIRED" } },
      },
    }),
    prisma.cap.count({ where: { status: "FLAGGED" } }),
  ])

  // Batch 2
  const [
    pairedToday,
    openedToday,
    failedPairings,
  ] = await Promise.all([
    prisma.cap.count({ where: { createdAt: { gte: today } } }),
    prisma.cap.count({
      where: { status: "OPENED", openedAt: { gte: today } },
    }),
    prisma.scanLog.count({
      where: {
        fraudFlag: true,
        flagReason: { contains: "mismatch" },
        scannedAt: { gte: last7Days },
      },
    }),
  ])

  // Batch 3
  const [recentPairingEvents, manufacturerPairingStats] = await Promise.all([
    // Recent cap creation events = successful pairings
    prisma.cap.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        topCode: true,
        hiddenSerialId: true,
        status: true,
        createdAt: true,
        openedAt: true,
        bottle: {
          select: {
            serialId: true,
            status: true,
            batch: {
              select: {
                batchCode: true,
                manufacturer: {
                  select: { companyName: true },
                },
                product: {
                  select: { name: true, authMode: true },
                },
              },
            },
          },
        },
      },
    }),

    // Per-manufacturer pairing stats
    prisma.manufacturer.findMany({
      where: { onboardingStatus: "ACTIVE_PRODUCTION" },
      select: {
        id: true,
        companyName: true,
        _count: {
          select: { bottles: true },
        },
      },
      take: 10,
    }),
  ])

  // Compute pairing rate
  const totalPairedProducts = await prisma.product.count({
    where: { authMode: "PAIRED" },
  })

  const pairingRate =
    totalPairedBottles + totalUnpairedBottles > 0
      ? (
          (totalPairedBottles /
            (totalPairedBottles + totalUnpairedBottles)) *
          100
        ).toFixed(1)
      : "100.0"

  return {
    totalPairedBottles,
    totalUnpairedBottles,
    totalFlaggedCaps,
    pairedToday,
    openedToday,
    failedPairings,
    recentPairingEvents,
    manufacturerPairingStats,
    pairingRate,
    totalPairedProducts,
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  )
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default async function PairingMonitorPage() {
  await requireAdmin()
  const metrics = await getPairingMetrics()

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <Link
          href="/admin/serialization"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Serialisation
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <h1 className="text-lg font-bold text-white tracking-tight">
              Pairing
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Cap and bottle pairings recorded on factory lines, and any
              mismatches found when shoppers scan.
            </p>
          </div>

          {/* Manual submit + scanner API info */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/serialization/pairing/submit"
              className="flex items-center gap-2 whitespace-nowrap px-3 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-xs hover:bg-gray-700 transition-colors"
            >
              Record a pairing
            </Link>
            <Link
              href="/admin/serialization/pairing/scanner-setup"
              className="flex items-center gap-2 whitespace-nowrap px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs hover:bg-blue-500/20 transition-colors"
            >
              <Cpu className="w-3.5 h-3.5" />
              Scanner setup
            </Link>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-gray-900/60 border border-gray-800/60 rounded-xl">
        <span className="text-xs text-gray-500">
          {metrics.pairingRate}% pairing rate
        </span>
        <span className="text-gray-500">·</span>
        <span className="text-xs text-gray-500">
          {metrics.totalUnpairedBottles} unpaired bottles
        </span>
        {metrics.totalUnpairedBottles > 0 && (
          <>
            <span className="text-gray-500">·</span>
            <span className="text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Requires investigation
            </span>
          </>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Total Paired",
            value: metrics.totalPairedBottles.toLocaleString(),
            accent: "text-green-400",
            icon: CheckCircle2,
          },
          {
            label: "Unpaired",
            value: metrics.totalUnpairedBottles.toLocaleString(),
            accent:
              metrics.totalUnpairedBottles > 0
                ? "text-red-400"
                : "text-gray-500",
            icon: XCircle,
          },
          {
            label: "Paired Today",
            value: metrics.pairedToday.toLocaleString(),
            accent: "text-blue-400",
            icon: Activity,
          },
          {
            label: "Opened Today",
            value: metrics.openedToday.toLocaleString(),
            accent: "text-purple-400",
            icon: Activity,
          },
          {
            label: "Failed Pairings",
            value: metrics.failedPairings.toLocaleString(),
            accent:
              metrics.failedPairings > 0
                ? "text-orange-400"
                : "text-gray-500",
            icon: AlertTriangle,
          },
          {
            label: "Flagged Caps",
            value: metrics.totalFlaggedCaps.toLocaleString(),
            accent:
              metrics.totalFlaggedCaps > 0
                ? "text-red-400"
                : "text-gray-500",
            icon: AlertTriangle,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] text-gray-400 font-medium">
                {card.label}
              </p>
              <card.icon className={`w-3 h-3 ${card.accent}`} />
            </div>
            <p className={`text-xl font-bold tabular-nums ${card.accent}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Pairing integrity visual */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-gray-400 font-medium">
            Pairing Integrity
          </h2>
          <span className="text-xs text-gray-500">
            {metrics.pairingRate}% of paired-mode bottles have a cap
          </span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              parseFloat(metrics.pairingRate) > 99
                ? "bg-green-500/60"
                : parseFloat(metrics.pairingRate) > 95
                ? "bg-yellow-500/60"
                : "bg-red-500/60"
            }`}
            style={{ width: `${metrics.pairingRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-400">
            {metrics.totalPairedBottles.toLocaleString()} paired
          </span>
          <span className="text-xs text-gray-400">
            {metrics.totalUnpairedBottles.toLocaleString()} unpaired
          </span>
        </div>
      </div>

      {/* Recent pairing events */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
          <div className="flex items-center gap-2">
            <h2 className="text-xs text-gray-300 font-medium">
              Recent pairings
            </h2>
          </div>
          <span className="text-xs text-gray-400">
            Last 20 cap-bottle pairings
          </span>
        </div>
        <div className="table-scroll">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-800/40">
              {[
                "Top Cap Code",
                "Bottle Serial",
                "Batch",
                "Product",
                "Manufacturer",
                "Cap Status",
                "Paired",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/40">
            {metrics.recentPairingEvents.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-xs text-gray-400"
                >
                  No pairing events yet
                </td>
              </tr>
            ) : (
              metrics.recentPairingEvents.map((cap) => {
                const statusConfig = {
                  SEALED: {
                    label: "Sealed",
                    style:
                      "bg-blue-500/10 text-blue-400 border-blue-500/20",
                  },
                  OPENED: {
                    label: "Opened",
                    style:
                      "bg-green-500/10 text-green-400 border-green-500/20",
                  },
                  FLAGGED: {
                    label: "Flagged",
                    style:
                      "bg-red-500/10 text-red-400 border-red-500/20",
                  },
                }[cap.status]

                return (
                  <tr
                    key={cap.id}
                    className={`hover:bg-gray-800/20 transition-colors ${
                      cap.status === "FLAGGED" ? "bg-red-500/5" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-gray-300">
                        {cap.topCode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-gray-500">
                        {cap.bottle?.serialId?.slice(0, 12) ?? "Unpaired"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-gray-500">
                        {cap.bottle?.batch?.batchCode ?? "None"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-400">
                        {cap.bottle?.batch?.product?.name ?? "None"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500">
                        {cap.bottle?.batch?.manufacturer?.companyName ??
                          "None"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${statusConfig.style}`}
                      >
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {timeAgo(cap.createdAt)}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}