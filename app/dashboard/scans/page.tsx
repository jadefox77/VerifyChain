import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ScanLine } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { card, tableHead } from "@/lib/ui"
import { formatDate, formatTime } from "@/lib/format"

export const metadata: Metadata = { title: "Scan activity" }

const PAGE_LIMIT = 100

const RESULT_TABS = [
  { key: "ALL", label: "All results" },
  { key: "GENUINE", label: "Genuine" },
  { key: "FRAUD", label: "Flagged" },
]

const LAYER_TABS = [
  { key: "ALL", label: "All codes" },
  { key: "BOTTLE", label: "Label" },
  { key: "CAP", label: "Cap" },
]

function Tabs({
  label,
  tabs,
  active,
  href,
}: {
  label: string
  tabs: { key: string; label: string }[]
  active: string
  href: (key: string) => string
}) {
  return (
    <nav aria-label={label} className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
      {tabs.map((tab) => {
        const isActive = active === tab.key
        return (
          <Link
            key={tab.key}
            href={href(tab.key)}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

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
  const filter = RESULT_TABS.some((t) => t.key === params.filter) ? params.filter! : "ALL"
  const layer = LAYER_TABS.some((t) => t.key === params.layer) ? params.layer! : "ALL"

  const where = {
    manufacturerId: manufacturer.id,
    ...(filter === "GENUINE" ? { fraudFlag: false } : {}),
    ...(filter === "FRAUD" ? { fraudFlag: true } : {}),
    ...(layer === "BOTTLE" ? { scanLayer: "BOTTLE" as const } : {}),
    ...(layer === "CAP" ? { scanLayer: "CAP" as const } : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.scanLog.findMany({
      where,
      orderBy: { scannedAt: "desc" },
      take: PAGE_LIMIT,
      include: {
        bottle: {
          include: {
            batch: { include: { product: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.scanLog.count({ where }),
  ])

  const hrefFor = (f: string, l: string) => `/dashboard/scans?filter=${f}&layer=${l}`

  return (
    <div className="space-y-6">
      <PageHeader title="Scan activity" description="Every time a shopper checks one of your products, it is recorded here." />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs label="Filter by result" tabs={RESULT_TABS} active={filter} href={(k) => hrefFor(k, layer)} />
        <Tabs label="Filter by code" tabs={LAYER_TABS} active={layer} href={(k) => hrefFor(filter, k)} />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {total > PAGE_LIMIT ? `Latest ${PAGE_LIMIT} of ${total.toLocaleString()}` : `${total.toLocaleString()} scans`}
        </span>
      </div>

      <section className={card}>
        {logs.length === 0 ? (
          <EmptyState
            icon={ScanLine}
            title={filter === "ALL" && layer === "ALL" ? "No scans yet" : "No scans match these filters"}
            description={
              filter === "ALL" && layer === "ALL"
                ? "Once shoppers start checking your products, each scan appears here with its result."
                : "Try a different combination of filters."
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-gray-200 dark:border-gray-800">
                <tr>
                  {["Time", "Product", "Code", "Location", "Result"].map((h) => (
                    <th key={h} scope="col" className={tableHead}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map((log) => (
                  <tr key={log.id} className={log.fraudFlag ? "bg-red-50/60 dark:bg-red-500/5" : undefined}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="text-sm text-gray-900 dark:text-white">{formatDate(log.scannedAt)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(log.scannedAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {log.bottle?.batch?.product?.name ?? "Unknown product"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {log.scanLayer === "CAP" ? "Cap" : "Label"}
                      </span>
                      {log.channel === "api" && <span className="ml-1.5 text-xs text-gray-500">via API</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {log.region ??
                        (log.lat != null && log.lng != null ? (
                          <span className="font-mono text-xs">
                            {log.lat.toFixed(3)}, {log.lng.toFixed(3)}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">Not shared</span>
                        ))}
                    </td>
                    <td className="px-4 py-3">
                      {log.fraudFlag ? (
                        <div className="max-w-xs">
                          <Badge tone="bad">Flagged</Badge>
                          {log.flagReason && (
                            <p className="mt-1 text-xs text-red-700 dark:text-red-300">{log.flagReason}</p>
                          )}
                        </div>
                      ) : (
                        <Badge tone="brand">Genuine</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
