"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, ScanLine } from "lucide-react"
import { CountdownTimer } from "@/components/verify/countdown-timer"
import { VerifyButton } from "@/components/verify/verify-button"
import { getLocation } from "@/components/verify/get-location"
import { ResultCard, WhatToDo } from "@/components/verify/result-card"
import { formatSerialId } from "@/lib/serial-format"
import {
  verifyBottleAction,
  type BottleActionResult,
} from "@/lib/verify-actions"

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}

const fmt = (d: Date | string) => new Date(d).toLocaleString("en-NG", DATE_FORMAT)

export function BottleVerify({ serialId, sig }: { serialId: string; sig?: string }) {
  const [result, setResult] = useState<BottleActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    setError(null)
    startTransition(async () => {
      try {
        const coords = await getLocation()
        setResult(await verifyBottleAction(serialId, sig, coords))
      } catch {
        setError("We could not complete the check. Check your internet connection and try again.")
      }
    })
  }

  if (!result) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Check this product
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Tap the button to confirm this pack is genuine. Your result appears on
            this screen in a few seconds.
          </p>
        </div>
        <VerifyButton onClick={run} pending={pending} />
        {error && (
          <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    )
  }

  switch (result.status) {
    case "INVALID":
    case "NOT_FOUND":
      return (
        <>
          <ResultCard tone="bad" title="We could not verify this product" message={result.message} />
          <WhatToDo />
        </>
      )

    case "RATE_LIMITED":
      return <ResultCard tone="wait" title="Please wait a moment" message={result.message} />

    case "FLAGGED":
      return (
        <>
          <ResultCard tone="bad" title="Do not use this product" message={result.message} />
          <WhatToDo />
        </>
      )

    case "CAP_ALREADY_OPENED":
      return (
        <>
          <ResultCard tone="bad" title="This bottle has been opened before" message={result.message} />
          <WhatToDo />
        </>
      )

    case "ALREADY_VERIFIED":
      return (
        <ResultCard
          tone="warn"
          title="Already checked"
          message={result.message}
          details={[{ label: "First checked", value: fmt(result.firstScan) }]}
        />
      )

    case "GENUINE_SINGLE":
      return (
        <ResultCard
          tone="good"
          title="Genuine product"
          message={result.message}
          details={[
            { label: "Product", value: result.productName },
            { label: "Checked", value: fmt(result.openedAt) },
          ]}
          note="This code can only be confirmed once. Anyone who scans it again will be told it was already checked."
        />
      )

    case "PROMPT_CAP":
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">Bottle found</p>
              <p className="mt-0.5 text-sm text-brand-900/80 dark:text-brand-100/80">{result.productName}</p>
            </div>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Step 2 of 2</p>
            <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
              <ScanLine className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              Scan the code inside the cap
            </h1>
            <ol className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              {[
                "Open the bottle.",
                "Find the QR code printed on the inside of the cap.",
                "Scan it with this phone's camera and tap Confirm.",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5">
              <CountdownTimer minutes={10} />
            </div>
            {result.topCode && (
              <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Code printed on top of the cap
                </p>
                <p className="mt-1 font-mono text-lg font-semibold tracking-widest text-gray-900 dark:text-white">
                  {formatSerialId(result.topCode)}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  If this does not match the code on your cap, the cap may have been swapped.
                </p>
              </div>
            )}
          </section>
        </div>
      )

    default:
      return null
  }
}
