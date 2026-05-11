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
          <h2 className="text-2xl font-bold text-gray-900">Products</h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage your product lines. Each batch is tied to a product.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Create product form */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-5">
            Add New Product
          </h3>
          <form action={createProduct} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium text-gray-700">
                Product Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Malta Gold 60cl"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="category" className="text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                id="category"
                name="category"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
              >
                <option value="">Select a category</option>
                <option value="Beer">Beer</option>
                <option value="Water">Bottled Water</option>
                <option value="Soft Drink">Soft Drink</option>
                <option value="Energy Drink">Energy Drink</option>
                <option value="Juice">Juice</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium text-gray-700">
                Description{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Brief description of the product"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 resize-none"
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
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-400 text-sm">No products yet. Add your first one.</p>
            </div>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{product.category}</p>
                  {product.description && (
                    <p className="text-xs text-gray-500 mt-1">{product.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1 font-medium">
                  {product.category}
                </span>
              </div>
            ))
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

  if (!name || !category) return

  await prisma.product.create({
    data: {
      manufacturerId: manufacturer.id,
      name,
      category,
      description: description || null,
    },
  })

  redirect("/dashboard/products")
}