import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { ArrowLeft, KeyRound } from "lucide-react"
import type { OnboardingStatus, SubscriptionPlan } from "@prisma/client"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/ui/page-header"
import { Notice } from "@/components/ui/auth-shell"
import { SubmitButton } from "@/components/ui/submit-button"
import { INDUSTRY_TYPES } from "@/lib/nigeria"
import { buttonPrimary, buttonSecondary, card, fieldHint, fieldLabel, inputBase } from "@/lib/ui"

export const metadata: Metadata = { title: "Create manufacturer account" }

// The one-time credentials are handed from the server action to the page in a
// short-lived httpOnly cookie, so the temporary password never appears in the
// URL, browser history or server logs.
const CREDENTIALS_COOKIE = "vc_new_mfr"
const COOKIE_PATH = "/admin/manufacturers/create"

const STATUSES: { value: OnboardingStatus; label: string }[] = [
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "COMPLIANCE_VERIFICATION", label: "Compliance checks" },
  { value: "TECHNICAL_INTEGRATION", label: "Technical setup" },
  { value: "PILOT_APPROVAL", label: "Pilot batch" },
  { value: "ACTIVE_PRODUCTION", label: "Live" },
]

const PLANS: { value: SubscriptionPlan; label: string }[] = [
  { value: "FREE", label: "Free" },
  { value: "STARTER", label: "Starter" },
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "ENTERPRISE", label: "Enterprise" },
]

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ""

async function readCredentials(): Promise<{ email: string; password: string } | null> {
  const raw = (await cookies()).get(CREDENTIALS_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.email === "string" && typeof parsed?.password === "string") return parsed
  } catch {
    // Ignore a malformed cookie
  }
  return null
}

export default async function CreateManufacturerPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>
}) {
  await requireSuperAdmin()
  const params = await searchParams
  const credentials = params.created === "true" ? await readCredentials() : null

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/manufacturers"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Manufacturers
      </Link>

      <PageHeader
        title="Create manufacturer account"
        description="For companies signed up in person or by the sales team. You will see a temporary password once, to pass on to them."
      />

      {params.created === "true" && !credentials && (
        <Notice tone="info">
          The account was created. For security, the temporary password is no longer shown. If it was not passed on,
          contact the development team to reset it.
        </Notice>
      )}

      {credentials && (
        <section className="space-y-4 rounded-xl border border-brand-500/30 bg-brand-500/10 p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-brand-200">Account created</h2>
          </div>
          <p className="text-sm text-brand-100/80">
            Share these details with the manufacturer securely. The temporary password is shown only here and disappears
            within two minutes.
          </p>
          <dl className="divide-y divide-gray-800 rounded-lg border border-gray-800 bg-gray-950/60 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <dt className="text-gray-400">Email</dt>
              <dd className="break-all text-white">{credentials.email}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <dt className="text-gray-400">Temporary password</dt>
              <dd className="font-mono font-semibold tracking-wider text-amber-300">{credentials.password}</dd>
            </div>
            {APP_URL && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <dt className="text-gray-400">Sign-in page</dt>
                <dd className="break-all text-gray-200">{APP_URL}/login</dd>
              </div>
            )}
          </dl>
          <p className="text-sm text-gray-400">They will be asked to choose a new password the first time they sign in.</p>
          <form action={clearCredentials} className="flex flex-wrap gap-3">
            <button type="submit" className={buttonPrimary}>
              I have saved these details
            </button>
            <Link href="/admin/manufacturers" className={buttonSecondary}>
              View manufacturers
            </Link>
          </form>
        </section>
      )}

      {params.error === "email_exists" && (
        <Notice tone="error">An account with that email address already exists. Use a different email.</Notice>
      )}
      {params.error === "missing" && (
        <Notice tone="error">Company name, contact name and email are required.</Notice>
      )}

      <form action={createManufacturerAccount} className={`${card} space-y-5 p-5`}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="companyName" className={fieldLabel}>
              Company name
            </label>
            <input id="companyName" name="companyName" required maxLength={200} placeholder="e.g. Kano Beverages Ltd" className={inputBase} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="rcNumber" className={fieldLabel}>
              RC number <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input id="rcNumber" name="rcNumber" maxLength={40} placeholder="e.g. RC-1234567" className={inputBase} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="contactName" className={fieldLabel}>
              Contact name
            </label>
            <input id="contactName" name="contactName" required maxLength={120} autoComplete="off" className={inputBase} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="phone" className={fieldLabel}>
              Phone <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input id="phone" name="phone" type="tel" maxLength={30} placeholder="+234 800 000 0000" className={inputBase} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className={fieldLabel}>
            Sign-in email
          </label>
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="off" placeholder="name@company.com" className={inputBase} />
          <p className={fieldHint}>The manufacturer signs in with this address. It must not belong to another account.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="industryType" className={fieldLabel}>
              Industry
            </label>
            <select id="industryType" name="industryType" defaultValue="" className={inputBase}>
              <option value="">Not specified</option>
              {INDUSTRY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="subscriptionPlan" className={fieldLabel}>
              Plan
            </label>
            <select id="subscriptionPlan" name="subscriptionPlan" defaultValue="FREE" className={inputBase}>
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="nafdacNumbers" className={fieldLabel}>
            NAFDAC numbers <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input id="nafdacNumbers" name="nafdacNumbers" maxLength={500} placeholder="e.g. A1-1234, A1-5678" className={inputBase} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="onboardingStatus" className={fieldLabel}>
            Starting stage
          </label>
          <select id="onboardingStatus" name="onboardingStatus" defaultValue="PENDING_REVIEW" className={inputBase}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p className={fieldHint}>Choose Live only if the company has already been checked offline.</p>
        </div>

        <div className="border-t border-gray-800 pt-5">
          <SubmitButton className={`${buttonPrimary} w-full`} pendingLabel="Creating account">
            Create account
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}

async function clearCredentials() {
  "use server"
  await requireSuperAdmin()
  ;(await cookies()).delete({ name: CREDENTIALS_COOKIE, path: COOKIE_PATH })
  redirect("/admin/manufacturers")
}

async function createManufacturerAccount(formData: FormData) {
  "use server"

  // Server actions are reachable by direct POST, so the role check has to be
  // repeated here, not only on the page.
  await requireSuperAdmin()

  const text = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max)

  const companyName = text("companyName", 200)
  const rcNumber = text("rcNumber", 40)
  const contactName = text("contactName", 120)
  const phone = text("phone", 30)
  const email = text("email", 254)
  const industryType = text("industryType", 100)
  const nafdacNumbers = text("nafdacNumbers", 500)
  const planInput = text("subscriptionPlan", 20)
  const statusInput = text("onboardingStatus", 40)

  if (!companyName || !email || !contactName) redirect(`${COOKIE_PATH}?error=missing`)

  const subscriptionPlan = PLANS.find((p) => p.value === planInput)?.value ?? "FREE"
  const onboardingStatus = STATUSES.find((s) => s.value === statusInput)?.value ?? "PENDING_REVIEW"

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) redirect(`${COOKIE_PATH}?error=email_exists`)

  // XXXX-XXXX, easy to read out over the phone
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase()
  const tempPassword = `${raw.slice(0, 4)}-${raw.slice(4)}`
  const hashed = await bcrypt.hash(tempPassword, 12)

  // Create both records together so a failure cannot leave a user without a company.
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: contactName,
        role: "MANUFACTURER_ADMIN",
        password: hashed,
        mustResetPassword: true,
      },
    })
    await tx.manufacturer.create({
      data: {
        userId: user.id,
        companyName,
        rcNumber: rcNumber || null,
        primaryContact: contactName,
        phone: phone || null,
        industryType: industryType || null,
        nafdacNumbers: nafdacNumbers || null,
        onboardingStatus,
        subscriptionPlan,
      },
    })
  })

  ;(await cookies()).set(CREDENTIALS_COOKIE, JSON.stringify({ email, password: tempPassword }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: COOKIE_PATH,
    maxAge: 120,
  })

  redirect(`${COOKIE_PATH}?created=true`)
}
