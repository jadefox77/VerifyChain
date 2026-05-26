import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

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
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold dark:text-white">Products</h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage your product lines. Each batch is tied to a product.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Create product form */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <h3 className="text-base font-semibold dark:text-white mb-5">
            Add New Product
          </h3>
          <form action={createProduct} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Product Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Malta Gold 60cl"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="category" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Category
              </label>
              <select
                id="category"
                name="category"
                required
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
              >
                <option value="">Select a category</option>
                <option value="Beer">Beer</option>
                <option value="Water">Bottled Water</option>
                <option value="Soft Drink">Soft Drink</option>
                <option value="Energy Drink">Energy Drink</option>
                <option value="Juice">Juice</option>
                <option value="Sachet">Sachet</option>
                <option value="Can">Can</option>
                <option value="Carton">Carton</option>
                <option value="Pouch">Pouch</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Auth Mode — core new field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="authMode" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Authentication Mode
              </label>
              <select
                id="authMode"
                name="authMode"
                defaultValue="PAIRED"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
              >
                <option value="PAIRED">
                  Paired — Bottle QR + Hidden Cap QR
                </option>
                <option value="SINGLE">
                  Single — One QR per unit
                </option>
              </select>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Paired Mode
                  </p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Bottles, jars, spirits. Detects refill fraud via hidden cap scan. Consumer scans twice.
                  </p>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Single Mode
                  </p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Cans, sachets, cartons, pouches. Instant one-scan verification. No cap required.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Description{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Brief description of the product"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 resize-none"
              />
            </div>

            <button
              type="submit"
              className="mt-1 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700 active:scale-95"
            >
              Add Product
            </button>
          </form>
        </div>

        {/* Product list */}
        <div className="flex flex-col gap-3">
          {products.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-500 text-sm">
                No products yet. Add your first one.
              </p>
            </div>
          ) : (
            products.map((product) => {
              const isPaired = product.authMode === "PAIRED"
              return (
                <div
                  key={product.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm px-5 py-4 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {product.category}
                    </p>
                    {product.description && (
                      <p className="text-xs text-gray-400 mt-1">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isPaired
                            ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                            : "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20"
                        }`}
                      >
                        {isPaired ? "Paired Auth" : "Single Auth"}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full px-2.5 py-1 font-medium">
                    {product.category}
                  </span>
                </div>
              )
            })
          )}
        </div>
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

  const name = formData.get("name") as string
  const category = formData.get("category") as string
  const description = formData.get("description") as string
  const authMode = (formData.get("authMode") as string) ?? "PAIRED"

  if (!name || !category) return

  await prisma.product.create({
    data: {
      manufacturerId: manufacturer.id,
      name,
      category,
      description: description || null,
      authMode: authMode as "PAIRED" | "SINGLE",
    },
  })

  redirect("/dashboard/products")
}