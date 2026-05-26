import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ArrowLeft, Upload } from "lucide-react"
import Link from "next/link"

export default async function ManualSubmitPage() {
  await requireAdmin()

  const manufacturers = await prisma.manufacturer.findMany({
    where: { onboardingStatus: "ACTIVE_PRODUCTION" },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  })

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/admin/serialization/pairing"
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 font-mono mb-6 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Pairing Monitor
      </Link>

      <h1 className="text-lg font-bold text-white mb-1">
        Manual Pairing Submission
      </h1>
      <p className="text-xs text-gray-500 font-mono mb-6">
        Submit pairing records manually after a production run. Use this
        when scanners are not yet integrated with the automatic API.
      </p>

      <div className="space-y-6">
        {/* Single pairing entry */}
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5">
          <h2 className="text-sm font-mono text-gray-300 mb-4">
            Single Pairing Entry
          </h2>
          <form action={submitSinglePairing} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                Manufacturer
              </label>
              <select
                name="manufacturerId"
                required
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-gray-600"
              >
                <option value="">Select manufacturer</option>
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                Bottle Serial ID
              </label>
              <input
                name="bottleSerialId"
                required
                placeholder="e.g. abc123xyz"
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                  Top Cap Code
                </label>
                <input
                  name="topCapCode"
                  required
                  placeholder="e.g. X7P2A9"
                  className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                  Hidden Serial ID
                </label>
                <input
                  name="hiddenSerialId"
                  required
                  placeholder="e.g. QR-K7L91X"
                  className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                Production Line ID
                <span className="text-gray-700 ml-1">(optional)</span>
              </label>
              <input
                name="lineId"
                placeholder="e.g. LINE-A"
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-mono hover:bg-blue-500 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Submit Pairing Record
            </button>
          </form>
        </div>

        {/* API info for future batch CSV upload */}
        <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
          <h2 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
            Batch CSV Upload — Coming Soon
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Upload a CSV file of pairing records from your shift. Format:
            one row per unit with columns{" "}
            <span className="font-mono text-gray-500">
              bottleSerialId, topCapCode, hiddenSerialId
            </span>
            . This feature is under development.
          </p>
        </div>
      </div>
    </div>
  )
}

async function submitSinglePairing(formData: FormData) {
  "use server"

  const manufacturerId = formData.get("manufacturerId") as string
  const bottleSerialId = formData.get("bottleSerialId") as string
  const topCapCode = formData.get("topCapCode") as string
  const hiddenSerialId = formData.get("hiddenSerialId") as string

  if (!manufacturerId || !bottleSerialId || !topCapCode || !hiddenSerialId) {
    return
  }

  const bottle = await prisma.bottle.findUnique({
    where: { serialId: bottleSerialId },
    include: { cap: true },
  })

  if (!bottle || bottle.cap) return

  // Check for duplicate cap identities
  const [existingTop, existingHidden] = await Promise.all([
    prisma.cap.findUnique({ where: { topCode: topCapCode } }),
    prisma.cap.findUnique({ where: { hiddenSerialId } }),
  ])

  if (existingTop || existingHidden) return

  const hiddenHmacSig = require("crypto")
    .createHmac("sha256", process.env.QR_SECRET!)
    .update(hiddenSerialId)
    .digest("hex")

  await prisma.cap.create({
    data: {
      bottleId: bottle.id,
      topCode: topCapCode,
      hiddenSerialId,
      hiddenHmacSig,
    },
  })

  redirect("/admin/serialization/pairing")
}