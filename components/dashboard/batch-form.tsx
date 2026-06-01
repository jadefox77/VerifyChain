"use client"

import { useState } from "react"
import { generateBatch } from "@/lib/actions/batches"

type Product = {
  id: string
  name: string
  authMode: string
}

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
  "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT — Abuja", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
]

export function BatchForm({ products }: { products: Product[] }) {
  const [selectedProductId, setSelectedProductId] = useState("")

  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const isPaired = selectedProduct?.authMode === "PAIRED"
  const isSingle = selectedProduct?.authMode === "SINGLE"

  return (
    <form action={generateBatch} className="flex flex-col gap-4">
      {/* Product selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Product
        </label>
        <select
          name="productId"
          required
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm outline-none transition focus:border-gray-900 dark:focus:border-gray-500"
        >
          <option value="">Select a product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.authMode === "PAIRED" ? "Paired Auth" : "Single Auth"}
            </option>
          ))}
        </select>
      </div>

      {/* Quantity */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Quantity
          <span className="text-gray-400 font-normal ml-1">(max 5,000)</span>
        </label>
        <input
          name="quantity"
          type="number"
          required
          min={1}
          max={5000}
          placeholder="e.g. 500"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm outline-none transition focus:border-gray-900 dark:focus:border-gray-500"
        />
      </div>

      {/* Generation mode — only show for PAIRED products */}
      {isPaired && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Generation Mode
          </label>
          <select
            name="generationMode"
            defaultValue="PRE_PAIRED"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm outline-none transition focus:border-gray-900 dark:focus:border-gray-500"
          >
            <option value="PRE_PAIRED">
              Pre-Paired — Bottle and cap linked at generation
            </option>
            <option value="UNPAIRED">
              Unpaired — Bottle and cap printed separately, paired on line
            </option>
          </select>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pre-Paired
              </p>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Each bottle QR is matched to a specific cap QR at
                generation. Best for integrated printing setups.
              </p>
            </div>
            <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                Unpaired
              </p>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Bottle and cap QRs generated independently. Pairing
                recorded on the production line via scanner or manual
                submit.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Single mode info — shown when single product selected */}
      {isSingle && (
        <div className="p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg">
          <p className="text-[11px] font-medium text-green-700 dark:text-green-400 mb-1">
            Single QR Mode
          </p>
          <p className="text-[10px] text-green-600 dark:text-green-400/70 leading-relaxed">
            One QR code per unit. Consumer scans once for immediate
            verification. No cap required.
          </p>
          <input type="hidden" name="generationMode" value="PRE_PAIRED" />
        </div>
      )}

      {/* No product selected placeholder */}
      {!selectedProduct && (
        <input type="hidden" name="generationMode" value="PRE_PAIRED" />
      )}

      {/* Target region */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Target Region
          <span className="text-gray-400 font-normal ml-1">
            (for drift detection)
          </span>
        </label>
        <select
          name="targetRegion"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm outline-none transition focus:border-gray-900 dark:focus:border-gray-500"
        >
          <option value="">Select region (optional)</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes
          <span className="text-gray-400 font-normal ml-1">(optional)</span>
        </label>
        <textarea
          name="notes"
          rows={2}
          placeholder="Production run notes..."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white shadow-sm outline-none transition focus:border-gray-900 dark:focus:border-gray-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={!selectedProductId}
        className="w-full rounded-lg bg-gray-900 dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-gray-900 shadow-sm transition hover:bg-gray-700 dark:hover:bg-gray-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Generate Batch
      </button>
    </form>
  )
}