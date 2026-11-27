import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import crypto from "crypto"
import { ArrowLeft } from "lucide-react"
import type { UserRole } from "@prisma/client"
import { canWrite, requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/ui/page-header"
import { Notice } from "@/components/ui/auth-shell"
import { SubmitButton } from "@/components/ui/submit-button"
import { buttonPrimary, card, cardHeader, cardTitle, fieldHint, fieldLabel, inputBase } from "@/lib/ui"

export const metadata: Metadata = { title: "Record a pairing" }

const PATH = "/admin/serialization/pairing/submit"

const ERRORS: Record<string, string> = {
  missing: "Fill in the manufacturer, bottle serial, top cap code and hidden serial.",
  bottle_not_found: "No bottle with that serial exists.",
  wrong_manufacturer: "That bottle belongs to a different manufacturer.",
  bottle_paired: "That bottle already has a cap paired to it.",
  cap_paired: "That hidden serial is already paired to another bottle.",
  forbidden: "Your role can view pairings but cannot record them.",
}

export default async function ManualSubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const session = await requireAdmin()
  const params = await searchParams
  const allowed = canWrite(session.user.role as UserRole)

  const manufacturers = await prisma.manufacturer.findMany({
    where: { onboardingStatus: "ACTIVE_PRODUCTION" },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  })

  const error = params.error ? ERRORS[params.error] : undefined

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/serialization/pairing"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pairing
      </Link>

      <PageHeader
        title="Record a pairing"
        description="Link a bottle to its cap by hand, for production lines whose scanners are not yet connected to the pairing API."
      />

      {params.saved && (
        <Notice tone="success">
          Pairing saved for bottle <span className="font-mono">{params.saved}</span>.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {!allowed && !error && <Notice tone="info">{ERRORS.forbidden}</Notice>}

      <section className={card}>
        <div className={cardHeader}>
          <h2 className={cardTitle}>Pairing details</h2>
        </div>
        <form action={submitSinglePairing} className="space-y-5 p-5">
          <fieldset disabled={!allowed} className="space-y-5 disabled:opacity-60">
            <div className="space-y-1.5">
              <label htmlFor="manufacturerId" className={fieldLabel}>
                Manufacturer
              </label>
              <select id="manufacturerId" name="manufacturerId" required defaultValue="" className={inputBase}>
                <option value="" disabled>
                  Choose a manufacturer
                </option>
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.companyName}
                  </option>
                ))}
              </select>
              <p className={fieldHint}>Only live manufacturers are listed.</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="bottleSerialId" className={fieldLabel}>
                Bottle serial
              </label>
              <input id="bottleSerialId" name="bottleSerialId" required maxLength={64} autoComplete="off" className={`${inputBase} font-mono`} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="topCapCode" className={fieldLabel}>
                  Top cap code
                </label>
                <input id="topCapCode" name="topCapCode" required maxLength={32} autoComplete="off" placeholder="e.g. X7P2A9" className={`${inputBase} font-mono`} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="hiddenSerialId" className={fieldLabel}>
                  Hidden serial
                </label>
                <input id="hiddenSerialId" name="hiddenSerialId" required maxLength={64} autoComplete="off" className={`${inputBase} font-mono`} />
              </div>
            </div>

            <SubmitButton className={`${buttonPrimary} w-full`} pendingLabel="Saving pairing" disabled={!allowed}>
              Save pairing
            </SubmitButton>
          </fieldset>
        </form>
      </section>
    </div>
  )
}

async function submitSinglePairing(formData: FormData) {
  "use server"

  // Server actions can be called directly, so check the role here as well.
  const session = await requireAdmin()
  if (!canWrite(session.user.role as UserRole)) redirect(`${PATH}?error=forbidden`)

  const text = (key: string) => String(formData.get(key) ?? "").trim().slice(0, 64)
  const manufacturerId = text("manufacturerId")
  const bottleSerialId = text("bottleSerialId")
  const topCapCode = text("topCapCode")
  const hiddenSerialId = text("hiddenSerialId")

  if (!manufacturerId || !bottleSerialId || !topCapCode || !hiddenSerialId) redirect(`${PATH}?error=missing`)

  const bottle = await prisma.bottle.findUnique({
    where: { serialId: bottleSerialId },
    include: { cap: true },
  })

  if (!bottle) redirect(`${PATH}?error=bottle_not_found`)
  if (bottle.manufacturerId !== manufacturerId) redirect(`${PATH}?error=wrong_manufacturer`)
  if (bottle.cap) redirect(`${PATH}?error=bottle_paired`)

  const existingCap = await prisma.cap.findUnique({ where: { hiddenSerialId } })

  if (existingCap && existingCap.bottleId !== null) redirect(`${PATH}?error=cap_paired`)

  if (existingCap) {
    // A cap generated with the batch but not yet linked to a bottle
    await prisma.cap.update({
      where: { id: existingCap.id },
      data: { bottleId: bottle.id },
    })
  } else {
    // A cap code read off the line by a scanner, not generated in advance
    const hiddenHmacSig = crypto.createHmac("sha256", process.env.QR_SECRET!).update(hiddenSerialId).digest("hex")

    await prisma.cap.create({
      data: {
        bottleId: bottle.id,
        topCode: topCapCode,
        hiddenSerialId,
        hiddenHmacSig,
      },
    })
  }

  redirect(`${PATH}?saved=${encodeURIComponent(bottleSerialId)}`)
}
