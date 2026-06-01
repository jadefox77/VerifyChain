import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Package, ChevronRight } from "lucide-react"
import { BatchForm } from "@/components/dashboard/batch-form"


export default async function BatchesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const [products, batches] = await Promise.all([
    prisma.product.findMany({
      where: { manufacturerId: manufacturer.id, active: true },
      orderBy: { createdAt: "desc" },
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

  const NIGERIAN_STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
    "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
    "Ekiti", "Enugu", "FCT — Abuja", "Gombe", "Imo", "Jigawa",
    "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
    "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
    "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Batches
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Generate serialized batches for each product run.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Generate batch form */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-5">
            Generate New Batch
          </h3>

          {products.length === 0 ? (
  <div className="text-center py-8">
    <p className="text-sm text-gray-500 mb-3">
      No products yet. Create a product first.
    </p>
    <Link
      href="/dashboard/products"
      className="text-sm text-blue-500 hover:underline"
    >
      Go to Products →
    </Link>
  </div>
) : (
  <BatchForm products={products} />
)}
        </div>

        {/* Batch list */}
        <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
          {batches.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-500 text-sm">
                No batches yet. Generate your first one.
              </p>
            </div>
          ) : (
            batches.map((batch) => {
              const isPaired = batch.product?.authMode === "PAIRED"
              return (
                <Link
                  key={batch.id}
                  href={`/dashboard/batches/${batch.id}`}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm px-5 py-4 flex items-center justify-between gap-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white truncate">
                        {batch.batchCode}
                      </p>
                      <span
                        className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                          isPaired
                            ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                            : "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20"
                        }`}
                      >
                        {isPaired ? "Paired" : "Single"}
                      </span>
                      {(batch as any).generationMode === "UNPAIRED" && (
  <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20">
    Unpaired
  </span>
)}
                    </div>
                    <p className="text-xs text-gray-500">
                      {batch.product?.name ?? "No product"} ·{" "}
                      {batch._count.bottles.toLocaleString()} bottles
                      {batch.targetRegion
                        ? ` · ${batch.targetRegion}`
                        : ""}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono mt-1">
                      {new Date(batch.createdAt).toLocaleDateString(
                        "en-NG",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}