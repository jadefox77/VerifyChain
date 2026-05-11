import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatSerialId } from "@/lib/serial"

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
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
      },
      _count: { select: { bottles: true } },
    },
  })

  if (!batch) redirect("/dashboard/batches")

  const mintCount = await prisma.bottle.count({
    where: { batchId: batch.id, status: "MINT" },
  })
  const openedCount = await prisma.bottle.count({
    where: { batchId: batch.id, status: "OPENED" },
  })
  const flaggedCount = await prisma.bottle.count({
    where: { batchId: batch.id, status: "FLAGGED" },
  })

  return (
    <div>
      <div className="mb-2">
        <a
          href="/dashboard/batches"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back to Batches
        </a>
      </div>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{batch.product.name}</h2>
          <p className="text-gray-500 text-sm mt-1">
            {batch.notes ?? "No notes"} ·{" "}
            {new Date(batch.createdAt).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
       <div className="flex gap-3 shrink-0">
   <a
    href={`/api/batches/${batch.id}/export`}
    className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
  >
    Download CSV
  </a>
  <a
    href={`/api/batches/${batch.id}/export-zip`}
    className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700 active:scale-95"
  >
    Download QR ZIP
  </a>
</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total", value: batch._count.bottles },
          { label: "Unopened", value: mintCount },
          { label: "Opened", value: openedCount },
          { label: "Flagged", value: flaggedCount, alert: flaggedCount > 0 },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
          >
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.alert ? "text-red-500" : "text-gray-900"}`}>
              {stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Serial preview */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Serial IDs{" "}
            <span className="text-gray-400 font-normal">
              (showing first 50 of {batch._count.bottles.toLocaleString()})
            </span>
          </h3>
        </div>

        <div className="divide-y divide-gray-100">
          {batch.bottles.map((bottle) => (
            <div
              key={bottle.id}
              className="px-6 py-3 flex items-center justify-between gap-4"
            >
              <span className="font-mono text-sm text-gray-900 tracking-widest">
                {formatSerialId(bottle.serialId)}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                bottle.status === "MINT"
                  ? "bg-green-50 text-green-700"
                  : bottle.status === "OPENED"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {bottle.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}