"use client"

import { useEffect, useMemo, useState } from "react"
import { saveBrandProfile } from "@/lib/actions/brand"
import {
  FONT_STYLES,
  LINK_FIELDS,
  MAX_IMAGE_BYTES,
  contrastRatio,
  normalizeHex,
  normalizeUrl,
  toBrandView,
  type FontStyle,
  type LinkKey,
  type ProductView,
} from "@/lib/brand"
import { BrandShell, ProductCard } from "@/components/verify/brand-shell"
import { ResultCard } from "@/components/verify/result-card"
import { VerifyButton } from "@/components/verify/verify-button"
import { SubmitButton } from "@/components/ui/submit-button"
import { buttonPrimary, card, cardHeader, cardTitle, fieldHint, fieldLabel, inputBase } from "@/lib/ui"

export type BrandFormValues = {
  enabled: boolean
  displayName: string
  tagline: string
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  fontStyle: FontStyle
  supportEmail: string
  supportPhone: string
  logoUrl: string | null
} & Record<LinkKey, string>

type PreviewState = "before" | "genuine" | "warning"

const COLOR_FIELDS = [
  { key: "primaryColor", label: "Main colour", hint: "Buttons and highlights" },
  { key: "secondaryColor", label: "Second colour", hint: "Top band and website button" },
  { key: "backgroundColor", label: "Background", hint: "Page background in light mode" },
] as const

function ColorField({
  name,
  label,
  hint,
  value,
  onChange,
}: {
  name: string
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
}) {
  // What the person is typing, until it is a valid colour or they leave the field
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className={fieldLabel}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
        />
        <input
          id={name}
          name={name}
          value={draft ?? value}
          maxLength={7}
          onChange={(e) => {
            setDraft(e.target.value)
            const hex = normalizeHex(e.target.value)
            if (hex) onChange(hex)
          }}
          onBlur={() => setDraft(null)}
          className={`${inputBase} font-mono`}
        />
      </div>
      <p className={fieldHint}>{hint}</p>
    </div>
  )
}

export function BrandForm({
  initial,
  companyName,
  sampleProduct,
}: {
  initial: BrandFormValues
  companyName: string
  sampleProduct: ProductView | null
}) {
  const [v, setV] = useState(initial)
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState>("before")

  const set = <K extends keyof BrandFormValues>(key: K, value: BrandFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  const brand = useMemo(() => {
    const links = Object.fromEntries(
      LINK_FIELDS.map(({ key }) => {
        const url = normalizeUrl(v[key])
        return [key, url && url !== "invalid" ? url : null]
      })
    ) as Record<LinkKey, string | null>
    return toBrandView(
      {
        displayName: v.displayName.trim() || null,
        tagline: v.tagline.trim() || null,
        logoImageId: null,
        primaryColor: v.primaryColor,
        secondaryColor: v.secondaryColor,
        backgroundColor: v.backgroundColor,
        fontStyle: v.fontStyle,
        supportEmail: v.supportEmail.trim() || null,
        supportPhone: v.supportPhone.trim() || null,
        ...links,
      },
      companyName,
      removeLogo ? null : logoPreview
    )
  }, [v, companyName, logoPreview, removeLogo])

  const product: ProductView = sampleProduct ?? {
    name: "Your product",
    category: null,
    description: null,
    imageUrl: null,
  }

  const lowContrast = contrastRatio(v.backgroundColor, "#ffffff") < 1.04
  const badLinks = LINK_FIELDS.filter(({ key }) => normalizeUrl(v[key]) === "invalid")

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <form action={saveBrandProfile} className={card}>
        <div className={cardHeader}>
          <h2 className={cardTitle}>Brand identity</h2>
        </div>
        <div className="space-y-6 p-5">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3.5 has-[:checked]:border-brand-600 dark:border-gray-800 dark:has-[:checked]:border-brand-400">
            <input
              type="checkbox"
              name="enabled"
              checked={v.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-600"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                Show my brand page when shoppers scan
              </span>
              <span className={fieldHint}>
                While this is off, you can save and preview changes, and shoppers keep seeing the standard VerifyChain
                page.
              </span>
            </span>
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="displayName" className={fieldLabel}>
                Brand name
              </label>
              <input
                id="displayName"
                name="displayName"
                maxLength={80}
                placeholder={companyName}
                value={v.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                className={inputBase}
              />
              <p className={fieldHint}>Leave empty to use your company name.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tagline" className={fieldLabel}>
                Tagline <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
              </label>
              <input
                id="tagline"
                name="tagline"
                maxLength={140}
                value={v.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                className={inputBase}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="logo" className={fieldLabel}>
              Logo
            </label>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                setLogoError(null)
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > MAX_IMAGE_BYTES) {
                  setLogoError("This file is over 300 KB. Choose a smaller one.")
                  e.target.value = ""
                  return
                }
                setRemoveLogo(false)
                setLogoPreview(URL.createObjectURL(file))
              }}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-100"
            />
            <p className={fieldHint}>PNG, JPEG or WebP, up to 300 KB. A wide logo on a transparent background works best.</p>
            {logoError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {logoError}
              </p>
            )}
            {initial.logoUrl && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  name="removeLogo"
                  checked={removeLogo}
                  onChange={(e) => setRemoveLogo(e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                Remove the current logo
              </label>
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className={fieldLabel}>Colours</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              {COLOR_FIELDS.map((f) => (
                <ColorField
                  key={f.key}
                  name={f.key}
                  label={f.label}
                  hint={f.hint}
                  value={v[f.key]}
                  onChange={(hex) => set(f.key, hex)}
                />
              ))}
            </div>
            {lowContrast && (
              <p className={fieldHint}>
                Your background is very close to white, so the result cards will blend in. A slightly tinted background
                reads better.
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className={fieldLabel}>Font</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(FONT_STYLES) as FontStyle[]).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm has-[:checked]:border-brand-600 dark:border-gray-800 dark:has-[:checked]:border-brand-400"
                  style={{ fontFamily: FONT_STYLES[key].stack }}
                >
                  <input
                    type="radio"
                    name="fontStyle"
                    value={key}
                    checked={v.fontStyle === key}
                    onChange={() => set("fontStyle", key)}
                    className="accent-brand-600"
                  />
                  <span className="text-gray-900 dark:text-white">{FONT_STYLES[key].label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className={fieldLabel}>Website and links</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {LINK_FIELDS.map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <label htmlFor={key} className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {label}
                  </label>
                  <input
                    id={key}
                    name={key}
                    inputMode="url"
                    placeholder={key === "websiteUrl" ? "https://yourbrand.com" : "https://"}
                    value={v[key]}
                    onChange={(e) => set(key, e.target.value)}
                    aria-invalid={normalizeUrl(v[key]) === "invalid"}
                    className={inputBase}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <label htmlFor="supportEmail" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Support email
                </label>
                <input
                  id="supportEmail"
                  name="supportEmail"
                  type="email"
                  value={v.supportEmail}
                  onChange={(e) => set("supportEmail", e.target.value)}
                  className={inputBase}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="supportPhone" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Support phone
                </label>
                <input
                  id="supportPhone"
                  name="supportPhone"
                  type="tel"
                  value={v.supportPhone}
                  onChange={(e) => set("supportPhone", e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>
            <p className={fieldHint}>Links must use https. They open in a new tab on the shopper&apos;s phone.</p>
            {badLinks.length > 0 && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                Check these links: {badLinks.map((l) => l.label).join(", ")}.
              </p>
            )}
          </fieldset>

          <SubmitButton className={`${buttonPrimary} w-full sm:w-auto`} pendingLabel="Saving" disabled={badLinks.length > 0}>
            Save brand page
          </SubmitButton>
        </div>
      </form>

      <section className={`${card} xl:sticky xl:top-6`} aria-labelledby="preview-title">
        <div className={cardHeader}>
          <h2 id="preview-title" className={cardTitle}>
            Preview
          </h2>
          <div role="tablist" aria-label="Preview state" className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {(
              [
                ["before", "Before"],
                ["genuine", "Genuine"],
                ["warning", "Warning"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={preview === key}
                onClick={() => setPreview(key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  preview === key
                    ? "bg-white text-gray-900 shadow-xs dark:bg-gray-950 dark:text-white"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3">
          <div className="mx-auto max-h-[44rem] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <BrandShell brand={brand} fullHeight={false}>
              {preview === "before" && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                      Check this product
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      Tap the button to confirm this pack is genuine.
                    </p>
                  </div>
                  <VerifyButton onClick={() => {}} pending={false} hint="" />
                </div>
              )}
              {preview === "genuine" && (
                <>
                  <ResultCard
                    tone="good"
                    title="Genuine product"
                    message={`This ${product.name} is genuine. This is the first time the cap has been opened.`}
                    details={[{ label: "Product", value: product.name }]}
                  />
                  <ProductCard product={product} />
                </>
              )}
              {preview === "warning" && (
                <ResultCard
                  tone="warn"
                  title="This cap was opened before"
                  message="This cap has already been opened and scanned. If you have just opened the product yourself, it may have been refilled."
                />
              )}
            </BrandShell>
          </div>
          <p className={`${fieldHint} mt-3 text-center`}>
            Result colours are fixed for every brand, so shoppers can always tell a pass from a warning.
          </p>
        </div>
      </section>
    </div>
  )
}
