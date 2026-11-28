"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import { saveProductDisplay } from "@/lib/actions/brand"
import { MAX_IMAGE_BYTES } from "@/lib/brand"
import { SubmitButton } from "@/components/ui/submit-button"
import { EmptyState } from "@/components/ui/empty-state"
import { buttonSecondary, card, cardHeader, cardTitle, fieldHint, inputBase } from "@/lib/ui"

type Row = { id: string; name: string; category: string | null; description: string; imageUrl: string | null }

function ProductRow({ product }: { product: Row }) {
  const [preview, setPreview] = useState(product.imageUrl)
  const [error, setError] = useState<string | null>(null)

  return (
    <li className="px-5 py-4">
      <form action={saveProductDisplay} className="flex flex-col gap-4 sm:flex-row">
        <input type="hidden" name="productId" value={product.id} />
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : (
            <Package className="h-6 w-6 text-gray-400" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{product.name}</p>
            {product.category && <p className={fieldHint}>{product.category}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor={`desc-${product.id}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Description shoppers see after a genuine result
            </label>
            <textarea
              id={`desc-${product.id}`}
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={product.description}
              className={`${inputBase} resize-y`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              <span className="sr-only">Picture for {product.name}</span>
              <input
                type="file"
                name="image"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  setError(null)
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > MAX_IMAGE_BYTES) {
                    setError("This file is over 300 KB.")
                    e.target.value = ""
                    return
                  }
                  setPreview(URL.createObjectURL(file))
                }}
                className="block text-xs text-gray-700 file:mr-2 file:rounded-md file:border-0 file:bg-gray-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-100"
              />
            </label>
            {product.imageUrl && (
              <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                <input type="checkbox" name="removeImage" className="h-3.5 w-3.5 accent-brand-600" />
                Remove picture
              </label>
            )}
            <SubmitButton className={`${buttonSecondary} ml-auto py-1.5`} pendingLabel="Saving">
              Save
            </SubmitButton>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </form>
    </li>
  )
}

export function ProductDisplayList({ products }: { products: Row[] }) {
  return (
    <section id="products" className={card} aria-labelledby="product-display">
      <div className={cardHeader}>
        <h2 id="product-display" className={cardTitle}>
          Product display
        </h2>
        <span className={fieldHint}>Shown on your brand page only</span>
      </div>
      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add products on the Products page, then give each one a picture and a short description here."
        />
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </ul>
      )}
    </section>
  )
}
