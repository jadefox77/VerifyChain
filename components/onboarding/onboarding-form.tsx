"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { INDUSTRY_TYPES, NIGERIAN_STATES } from "@/lib/nigeria"
import { buttonGhost, buttonPrimary, fieldHint, fieldLabel, inputBase } from "@/lib/ui"

type FormData = {
  // Company
  companyName: string
  rcNumber: string
  taxId: string
  industryType: string
  factoryLocations: string
  productionCapacity: string
  brandPortfolio: string
  // Contact
  primaryContact: string
  phone: string
  technicalContact: string
  complianceOfficer: string
  // Operations
  estimatedBottlesPerMonth: string
  packagingType: string
  capSupplier: string
  bottlingLineType: string
  erpSystem: string
  // Regulatory
  nafdacNumbers: string
  distributionRegions: string
}

const INITIAL: FormData = {
  companyName: "",
  rcNumber: "",
  taxId: "",
  industryType: "",
  factoryLocations: "",
  productionCapacity: "",
  brandPortfolio: "",
  primaryContact: "",
  phone: "",
  technicalContact: "",
  complianceOfficer: "",
  estimatedBottlesPerMonth: "",
  packagingType: "",
  capSupplier: "",
  bottlingLineType: "",
  erpSystem: "",
  nafdacNumbers: "",
  distributionRegions: "",
}

const STEPS = ["Company", "Contact", "Operations", "Regulatory", "Review"]

const PACKAGING_TYPES = ["PET plastic", "Glass", "Aluminium can", "Carton", "Mixed"]
const BOTTLING_LINE_TYPES = ["Fully automated", "Semi-automated", "Manual", "Mixed"]

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={fieldLabel}>
        {label}
        {required ? (
          <span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden="true">*</span>
        ) : (
          <span className="ml-1.5 font-normal text-gray-500 dark:text-gray-400">(optional)</span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className={fieldHint}>
          {hint}
        </p>
      )}
    </div>
  )
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  )
}

export function OnboardingForm({
  userEmail,
  userName,
}: {
  userEmail: string
  userName: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>({ ...INITIAL, primaryContact: userName })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const regions = form.distributionRegions
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  function canAdvance(): boolean {
    if (step === 0) return form.companyName.trim() !== "" && form.industryType !== ""
    if (step === 1) return form.primaryContact.trim() !== "" && form.phone.trim() !== ""
    if (step === 2) return form.estimatedBottlesPerMonth.trim() !== ""
    if (step === 3) return form.nafdacNumbers.trim() !== ""
    return true
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "We could not submit your application. Please try again.")
        setLoading(false)
        return
      }

      router.push("/onboarding/submitted")
    } catch {
      setError("We could not reach the server. Check your internet connection and try again.")
      setLoading(false)
    }
  }

  const review = [
    {
      title: "Company",
      fields: [
        { label: "Company name", value: form.companyName },
        { label: "RC number", value: form.rcNumber },
        { label: "Tax ID", value: form.taxId },
        { label: "Industry", value: form.industryType },
        { label: "Factory locations", value: form.factoryLocations },
        { label: "Daily capacity", value: form.productionCapacity ? Number(form.productionCapacity).toLocaleString() : "" },
        { label: "Brands", value: form.brandPortfolio },
      ],
    },
    {
      title: "Contact",
      fields: [
        { label: "Primary contact", value: form.primaryContact },
        { label: "Phone", value: form.phone },
        { label: "Technical contact", value: form.technicalContact },
        { label: "Compliance officer", value: form.complianceOfficer },
      ],
    },
    {
      title: "Operations",
      fields: [
        {
          label: "Units per month",
          value: form.estimatedBottlesPerMonth ? Number(form.estimatedBottlesPerMonth).toLocaleString() : "",
        },
        { label: "Packaging", value: form.packagingType },
        { label: "Cap supplier", value: form.capSupplier },
        { label: "Bottling line", value: form.bottlingLineType },
        { label: "ERP system", value: form.erpSystem },
      ],
    },
    {
      title: "Regulatory",
      fields: [
        { label: "NAFDAC numbers", value: form.nafdacNumbers },
        {
          label: "Distribution",
          value: regions
            .map((r) => NIGERIAN_STATES.find((s) => s.value === r)?.label ?? r)
            .join(", "),
        },
      ],
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900">
      {/* Progress */}
      <nav aria-label="Application progress" className="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-800">
        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => {
            const done = i < step
            const current = i === step
            return (
              <li key={label} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? "bg-brand-600 text-white dark:bg-brand-500 dark:text-gray-950"
                      : current
                        ? "border-2 border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                        : "border border-gray-300 text-gray-500 dark:border-gray-700 dark:text-gray-400"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span
                  className={`hidden text-sm sm:inline ${
                    current ? "font-medium text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" aria-hidden="true" />}
              </li>
            )
          })}
        </ol>
        <p className="mt-3 text-sm text-gray-600 sm:hidden dark:text-gray-400">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </nav>

      <div className="p-4 sm:p-6">
        {step === 0 && (
          <div className="space-y-5">
            <SectionTitle title="Company details" description="Tell us who you are and what you produce." />
            <Field id="companyName" label="Registered company name" required>
              <input
                id="companyName"
                className={inputBase}
                autoComplete="organization"
                placeholder="e.g. Lagos Beverages Ltd"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="rcNumber" label="RC number" hint="Your CAC registration number.">
                <input
                  id="rcNumber"
                  className={inputBase}
                  placeholder="e.g. RC1234567"
                  aria-describedby="rcNumber-hint"
                  value={form.rcNumber}
                  onChange={(e) => update("rcNumber", e.target.value)}
                />
              </Field>
              <Field id="taxId" label="Tax ID (TIN)">
                <input
                  id="taxId"
                  className={inputBase}
                  placeholder="e.g. 12345678-0001"
                  value={form.taxId}
                  onChange={(e) => update("taxId", e.target.value)}
                />
              </Field>
            </div>
            <Field id="industryType" label="Industry" required>
              <select
                id="industryType"
                className={inputBase}
                value={form.industryType}
                onChange={(e) => update("industryType", e.target.value)}
              >
                <option value="">Choose an industry</option>
                {INDUSTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="factoryLocations" label="Factory locations" hint="States or cities where you have factories.">
              <input
                id="factoryLocations"
                className={inputBase}
                placeholder="e.g. Lagos, Ogun, Kano"
                aria-describedby="factoryLocations-hint"
                value={form.factoryLocations}
                onChange={(e) => update("factoryLocations", e.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="productionCapacity" label="Production capacity" hint="Maximum units per day.">
                <input
                  id="productionCapacity"
                  className={inputBase}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="e.g. 50000"
                  aria-describedby="productionCapacity-hint"
                  value={form.productionCapacity}
                  onChange={(e) => update("productionCapacity", e.target.value)}
                />
              </Field>
              <Field id="brandPortfolio" label="Brands" hint="Separate brand names with commas.">
                <input
                  id="brandPortfolio"
                  className={inputBase}
                  placeholder="e.g. Brand A, Brand B"
                  aria-describedby="brandPortfolio-hint"
                  value={form.brandPortfolio}
                  onChange={(e) => update("brandPortfolio", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <SectionTitle title="Contact details" description="Who we should speak to during review and setup." />
            <p className="rounded-lg bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
              Signed in as <span className="font-medium text-gray-900 dark:text-white">{userEmail}</span>. This account
              will be your company&apos;s sign-in for VerifyChain.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="primaryContact" label="Primary contact name" required>
                <input
                  id="primaryContact"
                  className={inputBase}
                  autoComplete="name"
                  value={form.primaryContact}
                  onChange={(e) => update("primaryContact", e.target.value)}
                />
              </Field>
              <Field id="phone" label="Phone number" required>
                <input
                  id="phone"
                  className={inputBase}
                  type="tel"
                  autoComplete="tel"
                  placeholder="+234 800 000 0000"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </Field>
            </div>
            <Field id="technicalContact" label="Technical contact" hint="Name and email of the person who manages your IT or production systems.">
              <input
                id="technicalContact"
                className={inputBase}
                placeholder="e.g. Ada Obi, ada@company.com"
                aria-describedby="technicalContact-hint"
                value={form.technicalContact}
                onChange={(e) => update("technicalContact", e.target.value)}
              />
            </Field>
            <Field id="complianceOfficer" label="Compliance officer" hint="Name and email of your regulatory contact.">
              <input
                id="complianceOfficer"
                className={inputBase}
                placeholder="e.g. Tunde Bello, tunde@company.com"
                aria-describedby="complianceOfficer-hint"
                value={form.complianceOfficer}
                onChange={(e) => update("complianceOfficer", e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <SectionTitle title="Production" description="This helps us plan your integration and suggest a plan." />
            <Field
              id="estimatedBottlesPerMonth"
              label="Units produced per month"
              required
              hint="An estimate is fine. We use it to recommend a subscription plan."
            >
              <input
                id="estimatedBottlesPerMonth"
                className={inputBase}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="e.g. 100000"
                aria-describedby="estimatedBottlesPerMonth-hint"
                value={form.estimatedBottlesPerMonth}
                onChange={(e) => update("estimatedBottlesPerMonth", e.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="packagingType" label="Packaging">
                <select
                  id="packagingType"
                  className={inputBase}
                  value={form.packagingType}
                  onChange={(e) => update("packagingType", e.target.value)}
                >
                  <option value="">Choose packaging</option>
                  {PACKAGING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="capSupplier" label="Cap supplier" hint="The company that makes your caps or closures.">
                <input
                  id="capSupplier"
                  className={inputBase}
                  aria-describedby="capSupplier-hint"
                  value={form.capSupplier}
                  onChange={(e) => update("capSupplier", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="bottlingLineType" label="Bottling line">
                <select
                  id="bottlingLineType"
                  className={inputBase}
                  value={form.bottlingLineType}
                  onChange={(e) => update("bottlingLineType", e.target.value)}
                >
                  <option value="">Choose line type</option>
                  {BOTTLING_LINE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="erpSystem" label="ERP system" hint="For example SAP or Odoo. Leave blank if you do not use one.">
                <input
                  id="erpSystem"
                  className={inputBase}
                  aria-describedby="erpSystem-hint"
                  value={form.erpSystem}
                  onChange={(e) => update("erpSystem", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <SectionTitle title="Regulatory details" description="We check these during compliance review." />
            <Field
              id="nafdacNumbers"
              label="NAFDAC registration numbers"
              required
              hint="Separate numbers with commas."
            >
              <textarea
                id="nafdacNumbers"
                className={`${inputBase} resize-y`}
                rows={3}
                placeholder="e.g. A1-1234, A1-5678"
                aria-describedby="nafdacNumbers-hint"
                value={form.nafdacNumbers}
                onChange={(e) => update("nafdacNumbers", e.target.value)}
              />
            </Field>
            <fieldset className="flex flex-col gap-1.5">
              <legend className={fieldLabel}>
                Where your products are sold
                <span className="ml-1.5 font-normal text-gray-500 dark:text-gray-400">(optional)</span>
              </legend>
              <p className={`${fieldHint} mb-1`}>Choose every state you distribute to.</p>
              <div className="grid max-h-64 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded-lg border border-gray-300 p-3 sm:grid-cols-3 dark:border-gray-700">
                {NIGERIAN_STATES.map(({ value, label }) => {
                  const selected = regions.includes(value)
                  return (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...regions, value]
                            : regions.filter((s) => s !== value)
                          update("distributionRegions", updated.join(", "))
                        }}
                        className="h-4 w-4 rounded accent-brand-600"
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
              {regions.length > 0 && (
                <p className={fieldHint}>
                  {regions.length} {regions.length === 1 ? "state" : "states"} selected
                </p>
              )}
            </fieldset>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <SectionTitle title="Review your application" description="Check your details. You can go back to change anything." />
            <div className="space-y-4">
              {review.map((section, i) => (
                <div key={section.title} className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 dark:bg-gray-800/60">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                    <button
                      type="button"
                      onClick={() => setStep(i)}
                      className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
                    >
                      Edit
                    </button>
                  </div>
                  <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                    {section.fields
                      .filter((f) => f.value)
                      .map((f) => (
                        <div key={f.label} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[10rem_1fr] sm:gap-4">
                          <dt className="text-gray-500 dark:text-gray-400">{f.label}</dt>
                          <dd className="break-words text-gray-900 dark:text-gray-100">{f.value}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              ))}
            </div>
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
              Once you submit, our team reviews your application. Your dashboard
              opens after approval, and you can follow each review stage when you
              sign in.
            </p>
            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-4 sm:px-6 dark:border-gray-800 dark:bg-gray-900/60">
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className={`${buttonGhost} px-3 disabled:invisible`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className={buttonPrimary}
          >
            Continue
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading} className={buttonPrimary} aria-busy={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? "Submitting" : "Submit application"}
          </button>
        )}
      </div>
      {step < STEPS.length - 1 && !canAdvance() && (
        <p className="border-t border-gray-200 px-4 py-2.5 text-xs text-gray-500 sm:px-6 dark:border-gray-800 dark:text-gray-400">
          Fill in the fields marked * to continue.
        </p>
      )}
    </div>
  )
}
