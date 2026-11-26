"use client"

import { useState, useTransition } from "react"
import { VerifyButton } from "@/components/verify/verify-button"
import { getLocation } from "@/components/verify/get-location"
import { verifyCapAction, type CapActionResult } from "@/lib/verify-actions"

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}

export function CapVerify({
  hiddenSerialId,
  sig,
  bottle,
}: {
  hiddenSerialId: string
  sig?: string
  bottle?: string
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
        setError("Something went wrong. Check your connection and try again.")
      }
    })
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-900 dark:bg-white rounded-xl mb-3">
            <span className="text-white dark:text-gray-900 text-lg font-bold">V</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">VerifyChain Africa</p>
        </div>

        {!result && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Final step: confirm the cap
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Only tap once you have opened the bottle. This marks the cap as opened.
              </p>
            </div>
            <VerifyButton onClick={run} pending={pending} label="Tap to confirm" />
            {error && <p className="text-xs text-center text-red-500">{error}</p>}
          </div>
        )}

        {result?.status === "GENUINE" && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-green-900 dark:text-green-200 mb-2">
              Genuine Product
            </h1>
            <p className="text-green-700 dark:text-green-300 text-sm leading-relaxed mb-6">
              {result.message}
            </p>
            <div className="bg-green-100 dark:bg-green-900 rounded-xl p-4 text-left text-xs space-y-2 text-green-800 dark:text-green-300">
              <Row label="Product" value={result.productName} />
              <Row
                label="Verified at"
                value={new Date(result.openedAt).toLocaleString("en-NG", DATE_FORMAT)}
              />
              <Row
                label="Bottle and cap"
                value={result.pairingChecked ? "Matched ✓" : "Cap only"}
              />
            </div>
            {!result.pairingChecked && (
              <p className="mt-4 text-[11px] text-green-700/80 dark:text-green-300/70">
                Next time, scan the bottle label first so we can also confirm the cap belongs to it.
              </p>
            )}
          </div>
        )}

        {result?.status === "WARNING" && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-amber-900 dark:text-amber-200 mb-2">
              Cap Already Opened
            </h1>
            <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed">
              {result.message}
            </p>
            <div className="mt-6 bg-amber-100 dark:bg-amber-900 rounded-xl p-4 text-left text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <Row
                label="First opened"
                value={new Date(result.firstOpened).toLocaleString("en-NG", DATE_FORMAT)}
              />
              {result.firstLocation && <Row label="First location" value={result.firstLocation} />}
            </div>
          </div>
        )}

        {(result?.status === "MISMATCH" || result?.status === "FLAGGED") && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🚨</div>
            <h1 className="text-xl font-bold text-red-900 dark:text-red-200 mb-2">
              {result.status === "MISMATCH" ? "Identity Mismatch" : "Fraud Alert"}
            </h1>
            <p className="text-red-700 dark:text-red-300 text-sm leading-relaxed">{result.message}</p>
          </div>
        )}

        {(result?.status === "NOT_FOUND" ||
          result?.status === "INVALID" ||
          result?.status === "NEEDS_BOTTLE" ||
          result?.status === "RATE_LIMITED") && (
          <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">
              {result.status === "NEEDS_BOTTLE" ? "📷" : result.status === "RATE_LIMITED" ? "⏳" : "❌"}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {result.status === "NEEDS_BOTTLE"
                ? "Scan the bottle first"
                : result.status === "RATE_LIMITED"
                  ? "Slow down"
                  : "Not Found"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{result.message}</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          Powered by VerifyChain Africa
        </p>
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="font-medium">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}
