import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { generateBatch } from "@/lib/actions/batches"

export default async function BatchesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })
  if (!manufacturer) redirect("/onboarding")

  const [products, batches] = await Promise.all([
    prisma.product.findMany({
      where: { manufacturerId: manufacturer.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.batch.findMany({
      where: { manufacturerId: manufacturer.id },
      orderBy: { createdAt: "desc" },
      include: {
        product: true,
        _count: {
          select: {
            bottles: true,
          },
        },
      },
    }),
  ])

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Batches</h2>
        <p className="text-gray-500 text-sm mt-1">
          Generate serialized QR codes for your products.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-5">
              Generate New Batch
            </h3>
            <GenerateForm products={products} />
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-3">
          <BatchList batches={batches} />
        </div>
      </div>
    </div>
  )
}

type Product = {
  id: string
  name: string
}

type BatchItem = {
  id: string
  notes: string | null
  createdAt: Date
  product: { name: string }
  _count: { bottles: number }
}

function GenerateForm({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">You need to add a product first.</p>
        <a
          href="/dashboard/products"
          className="mt-3 inline-block text-sm font-medium text-gray-900 underline underline-offset-2"
        >
          Add a product
        </a>
      </div>
    )
  }

  return (
    <form action={generateBatch} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="productId" className="text-sm font-medium text-gray-700">
          Product
        </label>
        <select
          id="productId"
          name="productId"
          required
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
        >
          <option value="">Select a product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quantity" className="text-sm font-medium text-gray-700">
          Quantity
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          required
          min={1}
          max={5000}
          placeholder="e.g. 1000"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
        />
        <p className="text-xs text-gray-400">Maximum 5,000 per batch</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-gray-700">
          Notes{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="notes"
          name="notes"
          type="text"
          placeholder="e.g. April production run"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
        />
      </div>

      <button
        type="submit"
        className="mt-1 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700 active:scale-95"
      >
        Generate Batch
      </button>
    </form>
  )
}

function BatchList({ batches }: { batches: BatchItem[] }) {
  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
        <p className="text-gray-400 text-sm">
          No batches yet. Generate your first batch.
        </p>
      </div>
    )
  }

  return (
    <>
      {batches.map((batch) => (
        <BatchCard key={batch.id} batch={batch} />
      ))}
    </>
  )
}

function BatchCard({ batch }: { batch: BatchItem }) {
  const date = new Date(batch.createdAt).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <a
      href={`/dashboard/batches/${batch.id}`}
      className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-4 hover:border-gray-400 transition-colors"
    >
      <div>
        <p className="text-sm font-semibold text-gray-900">
          {batch.product.name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {batch.notes ?? "No notes"} · {date}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900">
          {batch._count.bottles.toLocaleString()}
        </p>
        <p className="text-xs text-gray-400">bottles</p>
      </div>
    </a>
  )
}