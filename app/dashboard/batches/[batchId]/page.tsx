import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatSerialId } from "@/lib/serial-format"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { buttonPrimary, buttonSecondary, card, cardHeader, cardTitle, tableHead } from "@/lib/ui"
import { formatDate } from "@/lib/format"
import { NIGERIAN_STATES } from "@/lib/nigeria"

export const metadata: Metadata = { title: "Batch details" }

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  MINT: { label: "Unopened", tone: "neutral" },
  OPENED: { label: "Opened", tone: "brand" },
  FLAGGED: { label: "Flagged", tone: "bad" },
}

export default async function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const batch = await prisma.batch.findFirst({
    where: { id: batchId, manufacturerId: manufacturer.id },
    include: {
      product: true,
      bottles: {
        take: 50,
        orderBy: { createdAt: "asc" },
        include: { cap: true },
      },
      _count: { select: { bottles: true } },
    },
  })

  if (!batch) redirect("/dashboard/batches")

  const [mintCount, openedCount, flaggedCount] = await Promise.all([
    prisma.bottle.count({ where: { batchId: batch.id, status: "MINT" } }),
    prisma.bottle.count({ where: { batchId: batch.id, status: "OPENED" } }),
    prisma.bottle.count({ where: { batchId: batch.id, status: "FLAGGED" } }),
  ])

  const isPaired = batch.product?.authMode !== "SINGLE"
  const region = batch.targetRegion
    ? NIGERIAN_STATES.find((s) => s.value === batch.targetRegion)?.label ?? batch.targetRegion
    : null

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/batches"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All batches
      </Link>

      <PageHeader
        title={batch.product?.name ?? "Unknown product"}
        description={
          <>
            <span className="font-mono">{batch.batchCode}</span> · Created {formatDate(batch.createdAt)}
            {region && <> · Target state: {region}</>}
          </>
        }
        actions={
          <>
            <a href={`/api/batches/${batch.id}/export`} className={buttonSecondary}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Serials (CSV)
            </a>
            <a href={`/api/batches/${batch.id}/export-zip`} className={buttonPrimary}>
              <Download className="h-4 w-4" aria-hidden="true" />
              QR codes (ZIP)
            </a>
          </>
        }
      />

      {batch.notes && (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          <span className="font-medium text-gray-900 dark:text-white">Notes: </span>
          {batch.notes}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Units" value={batch._count.bottles.toLocaleString()} />
        <StatCard label="Unopened" value={mintCount.toLocaleString()} />
        <StatCard label="Opened" value={openedCount.toLocaleString()} tone="good" />
        <StatCard label="Flagged" value={flaggedCount.toLocaleString()} tone={flaggedCount > 0 ? "bad" : "neutral"} />
      </div>

      <section className={card}>
        <div className={cardHeader}>
          <div>
            <h2 className={cardTitle}>Codes in this batch</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Showing the first {Math.min(50, batch._count.bottles)} of {batch._count.bottles.toLocaleString()}. The CSV
              contains every code.
            </p>
          </div>
          <div className="flex gap-2">
            <Badge tone={isPaired ? "info" : "violet"}>{isPaired ? "Label and cap" : "Single code"}</Badge>
            {batch.generationMode === "UNPAIRED" && <Badge tone="warn">Caps matched on line</Badge>}
          </div>
        </div>
        <div className="table-scroll">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40">
              <tr>
                <th scope="col" className={tableHead}>Label code</th>
                {isPaired && <th scope="col" className={tableHead}>Cap top code</th>}
                {isPaired && <th scope="col" className={tableHead}>Hidden cap code</th>}
                <th scope="col" className={tableHead}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {batch.bottles.map((bottle) => {
                const status = STATUS[bottle.status] ?? STATUS.MINT
                return (
                  <tr key={bottle.id}>
                    <td className="px-4 py-2.5 font-mono text-sm text-gray-900 dark:text-white">{formatSerialId(bottle.serialId)}</td>
                    {isPaired && (
                      <td className="px-4 py-2.5 font-mono text-sm text-gray-700 dark:text-gray-300">
                        {bottle.cap ? formatSerialId(bottle.cap.topCode) : <span className="text-gray-400">Not matched yet</span>}
                      </td>
                    )}
                    {isPaired && (
                      <td className="px-4 py-2.5 font-mono text-sm text-gray-500 dark:text-gray-400">
                        {bottle.cap ? `${bottle.cap.hiddenSerialId.slice(0, 8)}...` : <span className="text-gray-400">Not matched yet</span>}
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
