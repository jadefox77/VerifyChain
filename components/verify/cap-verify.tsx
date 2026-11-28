'use client'

import { useState, useTransition } from 'react'
import { ScanLine } from 'lucide-react'
import { VerifyButton } from '@/components/verify/verify-button'
import { getLocation } from '@/components/verify/get-location'
import { ResultCard, WhatToDo } from '@/components/verify/result-card'
import { ProductCard } from '@/components/verify/brand-shell'
import type { ProductView } from '@/lib/brand'
import { verifyCapAction, type CapActionResult } from '@/lib/verify-actions'

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: 'Africa/Lagos',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

const fmt = (d: Date | string) =>
  new Date(d).toLocaleString('en-NG', DATE_FORMAT)

export function CapVerify({
  hiddenSerialId,
  sig,
  bottle,
  product,
}: {
  hiddenSerialId: string
  sig?: string
  bottle?: string
  /** Set only when the brand has a published brand page */
  product?: ProductView | null
}) {
  const [result, setResult] = useState<CapActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    setError(null)
    startTransition(async () => {
      try {
        const coords = await getLocation()
        setResult(await verifyCapAction(hiddenSerialId, sig, bottle, coords))
      } catch {
        setError(
          'We could not complete the check. Check your internet connection and try again.'
        )
      }
    })
  }

  if (!result) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Final step
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Confirm the cap
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Only tap once the bottle is open. Confirming marks this cap as
            opened, so the code cannot be reused on another bottle.
          </p>
        </div>
        <VerifyButton onClick={run} pending={pending} label="Confirm cap" />
        {error && (
          <p
            role="alert"
            className="text-center text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </div>
    )
  }

  switch (result.status) {
    case 'GENUINE':
      return (
        <>
          <ResultCard
            tone="good"
            title="Genuine product"
            message={result.message}
            details={[
              { label: 'Product', value: result.productName },
              { label: 'Checked', value: fmt(result.openedAt) },
              {
                label: 'Bottle and cap',
                value: result.pairingChecked ? 'Matched' : 'Cap only',
              },
            ]}
            note={
              result.pairingChecked
                ? undefined
                : 'Next time, scan the bottle label first. That lets us also confirm the cap belongs to the bottle.'
            }
          />
          {product && <ProductCard product={product} />}
        </>
      )

    case 'WARNING':
      return (
        <>
          <ResultCard
            tone="warn"
            title="This cap was opened before"
            message={result.message}
            details={[
              { label: 'First opened', value: fmt(result.firstOpened) },
              ...(result.firstLocation
                ? [{ label: 'First location', value: result.firstLocation }]
                : []),
            ]}
          />
          <WhatToDo />
        </>
      )

    case 'MISMATCH':
      return (
        <>
          <ResultCard
            tone="bad"
            title="Cap and bottle do not match"
            message={result.message}
          />
          <WhatToDo />
        </>
      )

    case 'FLAGGED':
      return (
        <>
          <ResultCard
            tone="bad"
            title="Flagged for review"
            message={result.message}
          />
          <WhatToDo />
        </>
      )

    case 'NEEDS_BOTTLE':
      return (
        <ResultCard
          tone="neutral"
          title="Scan the bottle label first"
          message={result.message}
        >
          <ScanLine
            className="mx-auto mt-4 h-6 w-6 text-gray-400"
            aria-hidden="true"
          />
        </ResultCard>
      )

    case 'RATE_LIMITED':
      return (
        <ResultCard
          tone="wait"
          title="Please wait a moment"
          message={result.message}
        />
      )

    case 'NOT_FOUND':
    case 'INVALID':
      return (
        <>
          <ResultCard
            tone="bad"
            title="We could not verify this cap"
            message={result.message}
          />
          <WhatToDo />
        </>
      )

    default:
      return null
  }
}
