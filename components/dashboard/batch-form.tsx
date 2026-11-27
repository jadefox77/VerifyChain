"use client"

import { useState } from "react"
import { generateBatch } from "@/lib/actions/batches"
import { NIGERIAN_STATES } from "@/lib/nigeria"
import { SubmitButton } from "@/components/ui/submit-button"
import { buttonPrimary, fieldHint, fieldLabel, inputBase } from "@/lib/ui"

type Product = {
  id: string
  name: string
  authMode: string
}

export function BatchForm({
  products,
  blocked = false,
  remaining = null,
}: {
  products: Product[]
  // True once this month's plan allowance is used up
  blocked?: boolean
  // Units left this month, passed only when the account is close to its limit
  remaining?: number | null
}) {
  const [selectedProductId, setSelectedProductId] = useState("")
  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const isPaired = selectedProduct?.authMode === "PAIRED"

  return (
    <form action={generateBatch} className="space-y-5">
      <fieldset disabled={blocked} className="space-y-5 disabled:opacity-60">
      <div className="space-y-1.5">
        <label htmlFor="productId" className={fieldLabel}>
          Product
        </label>
        <select
          id="productId"
          name="productId"
          required
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className={inputBase}
        >
          <option value="">Choose a product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.authMode === "PAIRED" ? "label and cap" : "single code"})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="quantity" className={fieldLabel}>
          Number of units
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={5000}
          placeholder="e.g. 500"
          aria-describedby="quantity-hint"
          className={inputBase}
        />
        <p id="quantity-hint" className={fieldHint}>
          Up to 5,000 per batch. Each unit gets its own code.
          {remaining !== null && ` ${remaining.toLocaleString()} units left in this month's allowance.`}
        </p>
      </div>

      {isPaired ? (
        <fieldset className="space-y-2">
          <legend className={fieldLabel}>How caps are matched to bottles</legend>
          {[
            {
              value: "PRE_PAIRED",
              title: "Matched now",
              body: "Each bottle code is linked to its cap code when the batch is created. Best when labels and caps are printed together.",
            },
            {
              value: "UNPAIRED",
              title: "Matched on the production line",
              body: "Bottle and cap codes are printed separately and linked later by a line scanner or by hand.",
            },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer gap-3 rounded-lg border border-gray-300 p-3.5 transition-colors has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/60 dark:border-gray-700 dark:has-[:checked]:border-brand-400 dark:has-[:checked]:bg-brand-500/10"
            >
              <input
                type="radio"
                name="generationMode"
                value={opt.value}
                defaultChecked={opt.value === "PRE_PAIRED"}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">{opt.title}</span>
                <span className="mt-0.5 block text-sm text-gray-600 dark:text-gray-400">{opt.body}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <input type="hidden" name="generationMode" value="PRE_PAIRED" />
      )}

      {selectedProduct && !isPaired && (
        <p className="rounded-lg bg-gray-50 px-3.5 py-3 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
          This product uses one code per unit. Shoppers scan once and no cap code is needed.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="targetRegion" className={fieldLabel}>
          Target state <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
        </label>
        <select id="targetRegion" name="targetRegion" aria-describedby="targetRegion-hint" className={inputBase} defaultValue="">
          <option value="">Not specified</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <p id="targetRegion-hint" className={fieldHint}>
          Where this batch is meant to be sold. Scans far from it are flagged as possible diversion.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className={fieldLabel}>
          Notes <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={500}
          placeholder="e.g. Line 2, morning shift"
          className={`${inputBase} resize-y`}
        />
      </div>

      <SubmitButton className={`${buttonPrimary} w-full`} disabled={blocked || !selectedProductId} pendingLabel="Generating codes">
        Generate batch
      </SubmitButton>
      </fieldset>
    </form>
  )
}
