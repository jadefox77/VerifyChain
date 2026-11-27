import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Boxes, ChevronRight } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BatchForm } from "@/components/dashboard/batch-form"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { buttonPrimary, card, cardHeader, cardTitle } from "@/lib/ui"
import { formatDate } from "@/lib/format"
import { NIGERIAN_STATES } from "@/lib/nigeria"
import { getMonthlyUsage } from "@/lib/plans"
import { UsageNotice } from "@/components/dashboard/usage-notice"
import { Notice } from "@/components/ui/auth-shell"

export const metadata: Metadata = { title: "Batches" }

// The batch form's server action runs under this page. Creating a 5,000 unit
// batch in one transaction can take longer than the default limit.
export const maxDuration = 60

const regionLabel = (r: string) => NIGERIAN_STATES.find((s) => s.value === r)?.label ?? r

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const { error } = await searchParams

  const [usage, products, batches] = await Promise.all([
    getMonthlyUsage(manufacturer.id, manufacturer.subscriptionPlan),
    prisma.product.findMany({
      where: { manufacturerId: manufacturer.id, active: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, authMode: true },
    }),
    prisma.batch.findMany({
      where: { manufacturerId: manufacturer.id },
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, authMode: true } },
        _count: { select: { bottles: true } },
      },
    }),
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Batches"
        description="A batch is one production run. Generating a batch creates a unique code for every unit, ready to download and print."
      />

      {error === "limit" && usage.state !== "over" && (
        <Notice tone="error">That batch could not be generated because this month&apos;s allowance was used up.</Notice>
      )}
      <UsageNotice usage={usage} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <section className={card} aria-labelledby="new-batch">
          <div className={cardHeader}>
            <h2 id="new-batch" className={cardTitle}>
              Generate a batch
            </h2>
          </div>
          <div className="p-5">
            {products.length === 0 ? (
              <EmptyState
                className="py-6"
                title="Add a product first"
                description="Every batch belongs to a product, so you need at least one before generating codes."
                action={
                  <Link href="/dashboard/products" className={buttonPrimary}>
                    Add a product
                  </Link>
                }
              />
            ) : (
              <BatchForm
                products={products}
                blocked={usage.state === "over"}
                remaining={usage.state === "near" ? usage.remaining : null}
              />
            )}
          </div>
        </section>

        <section className={card} aria-labelledby="batch-list">
          <div className={cardHeader}>
            <h2 id="batch-list" className={cardTitle}>
              Your batches
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">{batches.length} total</span>
          </div>
          {batches.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No batches yet"
              description="Your batches will appear here once you generate the first one."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {batches.map((batch) => {
                const isPaired = batch.product?.authMode === "PAIRED"
                return (
                  <li key={batch.id}>
                    <Link
                      href={`/dashboard/batches/${batch.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {batch.product?.name ?? "No product"}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-gray-500 dark:text-gray-400">
                          {batch.batchCode}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Badge tone={isPaired ? "info" : "violet"}>{isPaired ? "Label and cap" : "Single code"}</Badge>
                          {batch.generationMode === "UNPAIRED" && <Badge tone="warn">Caps matched on line</Badge>}
                          <span>{batch._count.bottles.toLocaleString()} units</span>
                          {batch.targetRegion && <span>· {regionLabel(batch.targetRegion)}</span>}
                          <span>· {formatDate(batch.createdAt)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
