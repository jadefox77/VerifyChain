import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Package } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { SubmitButton } from "@/components/ui/submit-button"
import { buttonPrimary, card, cardHeader, cardTitle, fieldLabel, inputBase } from "@/lib/ui"

export const metadata: Metadata = { title: "Products" }

const CATEGORIES = [
  { value: "Beer", label: "Beer" },
  { value: "Water", label: "Bottled water" },
  { value: "Soft Drink", label: "Soft drink" },
  { value: "Energy Drink", label: "Energy drink" },
  { value: "Juice", label: "Juice" },
  { value: "Sachet", label: "Sachet" },
  { value: "Can", label: "Can" },
  { value: "Carton", label: "Carton" },
  { value: "Pouch", label: "Pouch" },
  { value: "Other", label: "Other" },
]

const categoryLabel = (v: string | null) => CATEGORIES.find((c) => c.value === v)?.label ?? v ?? "Uncategorised"

export default async function ProductsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const products = await prisma.product.findMany({
    where: { manufacturerId: manufacturer.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { batches: true } } },
  })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Products"
        description="Each batch of codes belongs to a product. Choose how a product is verified when you add it."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <section className={card} aria-labelledby="add-product">
          <div className={cardHeader}>
            <h2 id="add-product" className={cardTitle}>
              Add a product
            </h2>
          </div>
          <form action={createProduct} className="space-y-5 p-5">
            <div className="space-y-1.5">
              <label htmlFor="name" className={fieldLabel}>
                Product name
              </label>
              <input id="name" name="name" type="text" required maxLength={120} placeholder="e.g. Premium Malt 60cl" className={inputBase} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="category" className={fieldLabel}>
                Category
              </label>
              <select id="category" name="category" required defaultValue="" className={inputBase}>
                <option value="" disabled>
                  Choose a category
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="space-y-2">
              <legend className={fieldLabel}>How shoppers verify it</legend>
              {[
                {
                  value: "PAIRED",
                  title: "Two codes: label and cap",
                  body: "For bottles, jars and spirits. Shoppers scan the label, then the code inside the cap, which catches refilled bottles.",
                },
                {
                  value: "SINGLE",
                  title: "One code",
                  body: "For cans, sachets, cartons and pouches. One scan, and each code can be confirmed as genuine once.",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer gap-3 rounded-lg border border-gray-300 p-3.5 transition-colors has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/60 dark:border-gray-700 dark:has-[:checked]:border-brand-400 dark:has-[:checked]:bg-brand-500/10"
                >
                  <input
                    type="radio"
                    name="authMode"
                    value={opt.value}
                    defaultChecked={opt.value === "PAIRED"}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">{opt.title}</span>
                    <span className="mt-0.5 block text-sm text-gray-600 dark:text-gray-400">{opt.body}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-1.5">
              <label htmlFor="description" className={fieldLabel}>
                Description <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
              </label>
              <textarea id="description" name="description" rows={3} maxLength={500} className={`${inputBase} resize-y`} />
            </div>

            <SubmitButton className={`${buttonPrimary} w-full`} pendingLabel="Adding product">
              Add product
            </SubmitButton>
          </form>
        </section>

        <section className={card} aria-labelledby="product-list">
          <div className={cardHeader}>
            <h2 id="product-list" className={cardTitle}>
              Your products
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">{products.length} total</span>
          </div>
          {products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add your first product to start generating batches of codes."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {products.map((product) => (
                <li key={product.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{product.name}</p>
                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                      {categoryLabel(product.category)} · {product._count.batches}{" "}
                      {product._count.batches === 1 ? "batch" : "batches"}
                    </p>
                    {product.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{product.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Badge tone={product.authMode === "PAIRED" ? "info" : "violet"}>
                      {product.authMode === "PAIRED" ? "Label and cap" : "Single code"}
                    </Badge>
                    {!product.active && <Badge>Inactive</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

async function createProduct(formData: FormData) {
  "use server"

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")
  if (manufacturer.onboardingStatus !== "ACTIVE_PRODUCTION") redirect("/onboarding/pending")

  const name = String(formData.get("name") ?? "").trim()
  const category = String(formData.get("category") ?? "")
  const description = String(formData.get("description") ?? "").trim()
  const authMode = formData.get("authMode") === "SINGLE" ? "SINGLE" : "PAIRED"

  if (!name || !category) return

  await prisma.product.create({
    data: {
      manufacturerId: manufacturer.id,
      name: name.slice(0, 120),
      category,
      description: description ? description.slice(0, 500) : null,
      authMode,
    },
  })

  redirect("/dashboard/products")
}
