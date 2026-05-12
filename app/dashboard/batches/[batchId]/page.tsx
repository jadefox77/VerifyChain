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
      include: { cap: true },
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
     <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
      Identity Preview{" "}
      <span className="text-gray-400 font-normal">
        (showing first 50 of {batch._count.bottles.toLocaleString()})
      </span>
    </h3>
  </div>

  {/* Header */}
  <div className="hidden md:grid grid-cols-4 gap-4 px-6 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Bottle QR</p>
    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top-Cap Code</p>
    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hidden Cap QR</p>
    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Status</p>
  </div>

  <div className="divide-y divide-gray-100 dark:divide-gray-800">
    {batch.bottles.map((bottle) => (
      <div
        key={bottle.id}
        className="px-6 py-3 grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-center"
      >
        <span className="font-mono text-xs text-gray-900 dark:text-white">
          {formatSerialId(bottle.serialId)}
        </span>
        <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold tracking-widest">
          {bottle.cap ? formatSerialId(bottle.cap.topCode) : "—"}
        </span>
        <span className="font-mono text-xs text-gray-400 dark:text-gray-500 truncate">
          {bottle.cap ? bottle.cap.hiddenSerialId.slice(0, 12) + "..." : "—"}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
          bottle.status === "MINT"
            ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400"
            : bottle.status === "OPENED"
            ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
            : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400"
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