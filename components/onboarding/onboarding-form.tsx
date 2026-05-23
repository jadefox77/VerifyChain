"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  User,
  Factory,
  ScrollText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react"

type FormData = {
  // Step 1 — Company
  companyName: string
  rcNumber: string
  taxId: string
  industryType: string
  factoryLocations: string
  productionCapacity: string
  brandPortfolio: string

  // Step 2 — Contact
  primaryContact: string
  phone: string
  technicalContact: string
  complianceOfficer: string

  // Step 3 — Operational
  estimatedBottlesPerMonth: string
  packagingType: string
  capSupplier: string
  bottlingLineType: string
  erpSystem: string

  // Step 4 — Regulatory
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

const STEPS = [
  { label: "Company", icon: Building2 },
  { label: "Contact", icon: User },
  { label: "Operations", icon: Factory },
  { label: "Regulatory", icon: ScrollText },
  { label: "Review", icon: CheckCircle2 },
]

const INDUSTRY_TYPES = [
  "Beverage — Beer",
  "Beverage — Soft Drink",
  "Beverage — Water",
  "Beverage — Energy Drink",
  "Spirits & Alcoholic Beverages",
  "Dairy",
  "Food & Consumables",
  "Other",
]

const PACKAGING_TYPES = ["PET Plastic", "Glass", "Aluminum Can", "Carton", "Mixed"]
const BOTTLING_LINE_TYPES = ["Fully Automated", "Semi-Automated", "Manual", "Mixed"]
const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
  "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT — Abuja", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
]

// ── Input components ──────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-300">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-gray-600">{hint}</p>
      )}
    </div>
  )
}

const inputClass =
  "w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 outline-none transition focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"

const selectClass =
  "w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-gray-200 outline-none transition focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"

// ── Main component ────────────────────────────────────────────────────────────

export function OnboardingForm({
  userEmail,
  userName,
}: {
  userEmail: string
  userName: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function canAdvance(): boolean {
    if (step === 0)
      return (
        form.companyName.trim() !== "" &&
        form.industryType !== ""
      )
    if (step === 1)
      return (
        form.primaryContact.trim() !== "" &&
        form.phone.trim() !== ""
      )
    if (step === 2)
      return form.estimatedBottlesPerMonth.trim() !== ""
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
        const data = await res.json()
        setError(data.error ?? "Something went wrong. Please try again.")
        setLoading(false)
        return
      }

      router.push("/onboarding/submitted")
    } catch {
      setError("Network error. Please check your connection.")
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl overflow-hidden">
      {/* Step indicators */}
      <div className="flex border-b border-gray-800/60">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isDone = i < step
          const isCurrent = i === step
          return (
            <div
              key={s.label}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-center border-r border-gray-800/60 last:border-r-0 transition-colors ${
                isCurrent
                  ? "bg-blue-500/5 border-b-2 border-b-blue-500"
                  : isDone
                  ? "bg-green-500/5"
                  : ""
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isDone
                    ? "text-green-400"
                    : isCurrent
                    ? "text-blue-400"
                    : "text-gray-600"
                }`}
              />
              <span
                className={`text-[10px] font-mono hidden sm:block ${
                  isDone
                    ? "text-green-400"
                    : isCurrent
                    ? "text-blue-400"
                    : "text-gray-600"
                }`}
              >
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Form content */}
      <div className="p-6">
        {/* Step 1 — Company Information */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="mb-2">
              <h2 className="text-base font-bold text-white">
                Company Information
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Basic details about your manufacturing company
              </p>
            </div>

            <Field label="Company Name" required>
              <input
                className={inputClass}
                placeholder="e.g. Lagos Beverages Ltd"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="RC Number"
                hint="CAC registration number"
              >
                <input
                  className={inputClass}
                  placeholder="RC-1234567"
                  value={form.rcNumber}
                  onChange={(e) => update("rcNumber", e.target.value)}
                />
              </Field>
              <Field label="Tax ID (TIN)">
                <input
                  className={inputClass}
                  placeholder="e.g. 12345678-0001"
                  value={form.taxId}
                  onChange={(e) => update("taxId", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Industry Type" required>
              <select
                className={selectClass}
                value={form.industryType}
                onChange={(e) => update("industryType", e.target.value)}
              >
                <option value="">Select industry type</option>
                {INDUSTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Factory Locations"
              hint="List the states or cities where your factories are located"
            >
              <input
                className={inputClass}
                placeholder="e.g. Lagos, Ogun, Kano"
                value={form.factoryLocations}
                onChange={(e) => update("factoryLocations", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Production Capacity"
                hint="Maximum bottles per day (factory-rated)"
              >
                <input
                  className={inputClass}
                  type="number"
                  placeholder="e.g. 50000"
                  value={form.productionCapacity}
                  onChange={(e) =>
                    update("productionCapacity", e.target.value)
                  }
                />
              </Field>
              <Field
                label="Brand Portfolio"
                hint="Comma-separated list of your brands"
              >
                <input
                  className={inputClass}
                  placeholder="e.g. BrandA, BrandB"
                  value={form.brandPortfolio}
                  onChange={(e) => update("brandPortfolio", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Step 2 — Contact Information */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="mb-2">
              <h2 className="text-base font-bold text-white">
                Contact Information
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Who should we contact for onboarding and technical support
              </p>
            </div>

            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-400 font-mono">
                Signed in as {userName} · {userEmail}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Primary Contact Name" required>
                <input
                  className={inputClass}
                  placeholder="Full name"
                  value={form.primaryContact}
                  onChange={(e) =>
                    update("primaryContact", e.target.value)
                  }
                />
              </Field>
              <Field label="Phone Number" required>
                <input
                  className={inputClass}
                  type="tel"
                  placeholder="+234 800 000 0000"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Technical Contact"
              hint="Name and email of your IT or integration contact"
            >
              <input
                className={inputClass}
                placeholder="e.g. John Doe — john@company.com"
                value={form.technicalContact}
                onChange={(e) =>
                  update("technicalContact", e.target.value)
                }
              />
            </Field>

            <Field
              label="Compliance Officer"
              hint="Name and email of your regulatory compliance contact"
            >
              <input
                className={inputClass}
                placeholder="e.g. Jane Smith — jane@company.com"
                value={form.complianceOfficer}
                onChange={(e) =>
                  update("complianceOfficer", e.target.value)
                }
              />
            </Field>
          </div>
        )}

        {/* Step 3 — Operational Information */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="mb-2">
              <h2 className="text-base font-bold text-white">
                Operational Information
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Details about your production setup and existing systems
              </p>
            </div>

            <Field
              label="Estimated Bottles Per Month"
              required
              hint="This determines your subscription plan"
            >
              <input
                className={inputClass}
                type="number"
                placeholder="e.g. 100000"
                value={form.estimatedBottlesPerMonth}
                onChange={(e) =>
                  update("estimatedBottlesPerMonth", e.target.value)
                }
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Packaging Type">
                <select
                  className={selectClass}
                  value={form.packagingType}
                  onChange={(e) =>
                    update("packagingType", e.target.value)
                  }
                >
                  <option value="">Select packaging type</option>
                  {PACKAGING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Cap Supplier"
                hint="Name of your cap manufacturer"
              >
                <input
                  className={inputClass}
                  placeholder="e.g. Nampak Nigeria"
                  value={form.capSupplier}
                  onChange={(e) => update("capSupplier", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Bottling Line Type">
                <select
                  className={selectClass}
                  value={form.bottlingLineType}
                  onChange={(e) =>
                    update("bottlingLineType", e.target.value)
                  }
                >
                  <option value="">Select line type</option>
                  {BOTTLING_LINE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Existing ERP System"
                hint="Leave blank if none"
              >
                <input
                  className={inputClass}
                  placeholder="e.g. SAP, Odoo, None"
                  value={form.erpSystem}
                  onChange={(e) => update("erpSystem", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Step 4 — Regulatory Information */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="mb-2">
              <h2 className="text-base font-bold text-white">
                Regulatory Information
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Your NAFDAC registrations and distribution coverage
              </p>
            </div>

            <Field
              label="NAFDAC Registration Numbers"
              required
              hint="Comma-separated list of all your NAFDAC registration numbers"
            >
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="e.g. NAFDAC/FD/2023/001, NAFDAC/FD/2023/002"
                value={form.nafdacNumbers}
                onChange={(e) =>
                  update("nafdacNumbers", e.target.value)
                }
              />
            </Field>

            <Field
              label="Distribution Regions"
              hint="Select all states where your products are distributed"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-gray-800/40 border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                {NIGERIAN_STATES.map((state) => {
                  const selected = form.distributionRegions
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .includes(state)

                  return (
                    <label
                      key={state}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const current = form.distributionRegions
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                          const updated = e.target.checked
                            ? [...current, state]
                            : current.filter((s) => s !== state)
                          update(
                            "distributionRegions",
                            updated.join(", ")
                          )
                        }}
                        className="w-3 h-3 accent-blue-500"
                      />
                      <span className="text-xs text-gray-400">
                        {state}
                      </span>
                    </label>
                  )
                })}
              </div>
              {form.distributionRegions && (
                <p className="text-[10px] text-gray-600 font-mono mt-1">
                  Selected:{" "}
                  {
                    form.distributionRegions
                      .split(",")
                      .filter(Boolean).length
                  }{" "}
                  states
                </p>
              )}
            </Field>
          </div>
        )}

        {/* Step 5 — Review */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="mb-2">
              <h2 className="text-base font-bold text-white">
                Review & Submit
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Confirm your details before submitting your application
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  title: "Company",
                  fields: [
                    { label: "Company Name", value: form.companyName },
                    { label: "RC Number", value: form.rcNumber },
                    { label: "Tax ID", value: form.taxId },
                    { label: "Industry", value: form.industryType },
                    { label: "Locations", value: form.factoryLocations },
                    { label: "Brands", value: form.brandPortfolio },
                  ],
                },
                {
                  title: "Contact",
                  fields: [
                    {
                      label: "Primary Contact",
                      value: form.primaryContact,
                    },
                    { label: "Phone", value: form.phone },
                    {
                      label: "Technical Contact",
                      value: form.technicalContact,
                    },
                    {
                      label: "Compliance Officer",
                      value: form.complianceOfficer,
                    },
                  ],
                },
                {
                  title: "Operations",
                  fields: [
                    {
                      label: "Est. Bottles/Month",
                      value: form.estimatedBottlesPerMonth
                        ? parseInt(
                            form.estimatedBottlesPerMonth
                          ).toLocaleString()
                        : "",
                    },
                    { label: "Packaging", value: form.packagingType },
                    { label: "Cap Supplier", value: form.capSupplier },
                    {
                      label: "Bottling Line",
                      value: form.bottlingLineType,
                    },
                    { label: "ERP", value: form.erpSystem },
                  ],
                },
                {
                  title: "Regulatory",
                  fields: [
                    {
                      label: "NAFDAC Numbers",
                      value: form.nafdacNumbers,
                    },
                    {
                      label: "Distribution Regions",
                      value: form.distributionRegions,
                    },
                  ],
                },
              ].map((section) => (
                <div
                  key={section.title}
                  className="border border-gray-800/60 rounded-lg overflow-hidden"
                >
                  <div className="px-3 py-2 bg-gray-800/40 border-b border-gray-800/60">
                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                      {section.title}
                    </p>
                  </div>
                  <div className="divide-y divide-gray-800/40">
                    {section.fields
                      .filter((f) => f.value)
                      .map((f) => (
                        <div
                          key={f.label}
                          className="flex px-3 py-2 gap-4"
                        >
                          <span className="text-[11px] text-gray-600 w-32 shrink-0">
                            {f.label}
                          </span>
                          <span className="text-[11px] text-gray-300 font-mono">
                            {f.value}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-400">
                After submission your application enters{" "}
                <strong>Pending Review</strong>. You will not have
                dashboard access until a VerifyChain administrator
                approves your application.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/60 bg-gray-900/40">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <span className="text-[10px] font-mono text-gray-600">
          Step {step + 1} of {STEPS.length}
        </span>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        )}
      </div>
    </div>
  )
}