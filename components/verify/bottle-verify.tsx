"use client"

import { useState, useTransition, type ReactNode } from "react"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ScanLine,
} from "lucide-react"
import { CountdownTimer } from "@/components/verify/countdown-timer"
import { VerifyButton } from "@/components/verify/verify-button"
import { getLocation } from "@/components/verify/get-location"
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

export function BottleVerify({
  serialId,
  sig,
}: {
  serialId: string
  sig?: string
}) {
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
        setError("Something went wrong. Check your connection and try again.")
      }
    })
  }

  if (!result) {
    return (
      <div className="w-full max-w-sm mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-bold text-white">Verify this product</h1>
          <p className="text-sm text-gray-400">
            Tap the button to check that this bottle is genuine.
          </p>
        </div>
        <VerifyButton onClick={run} pending={pending} />
        {error && <p className="text-xs text-center text-red-400">{error}</p>}
      </div>
    )
  }

  switch (result.status) {
    case "INVALID":
    case "NOT_FOUND":
      return (
        <StatusCard
          icon={<XCircle className="w-10 h-10 text-red-400" />}
          bg="bg-red-500/10"
          border="border-red-500/20"
          title="Product Not Found"
          message={result.message}
          severity="danger"
        />
      )

    case "RATE_LIMITED":
      return (
        <StatusCard
          icon={<AlertTriangle className="w-10 h-10 text-yellow-400" />}
          bg="bg-yellow-500/10"
          border="border-yellow-500/20"
          title="Slow down"
          message={result.message}
          severity="warning"
        />
      )

    case "FLAGGED":
      return (
        <StatusCard
          icon={<XCircle className="w-10 h-10 text-red-400" />}
          bg="bg-red-500/10"
          border="border-red-500/20"
          title="Fraud Detected"
          message={result.message}
          severity="danger"
        />
      )

    case "CAP_ALREADY_OPENED":
      return (
        <StatusCard
          icon={<AlertTriangle className="w-10 h-10 text-orange-400" />}
          bg="bg-orange-500/10"
          border="border-orange-500/20"
          title="Possible Refill Detected"
          message={result.message}
          severity="warning"
        />
      )

    case "ALREADY_VERIFIED":
      return (
        <StatusCard
          icon={<AlertTriangle className="w-10 h-10 text-yellow-400" />}
          bg="bg-yellow-500/10"
          border="border-yellow-500/20"
          title="Already Verified"
          message={result.message}
          severity="warning"
          sub={`First verified: ${new Date(result.firstScan).toLocaleDateString("en-NG", DATE_FORMAT)}`}
        />
      )

    case "GENUINE_SINGLE":
      return (
        <StatusCard
          icon={<CheckCircle2 className="w-10 h-10 text-green-400" />}
          bg="bg-green-500/10"
          border="border-green-500/20"
          title="Genuine Product"
          message={result.message}
          severity="success"
          sub={`Verified: ${new Date(result.openedAt).toLocaleDateString("en-NG", DATE_FORMAT)}`}
          badge="Single-Scan Verified"
        />
      )

    case "PROMPT_CAP":
      return (
        <div className="w-full max-w-sm mx-auto space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-400">Step 1 Complete</p>
              <p className="text-xs text-green-400/70 mt-0.5">
                Bottle identity confirmed — {result.productName}
              </p>
            </div>
          </div>

          <div className="p-5 bg-gray-900/80 border border-gray-700 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-blue-400" />
              <p className="text-sm font-semibold text-white">
                Step 2 — Scan the Hidden Cap QR
              </p>
            </div>
            <ol className="space-y-2">
              {[
                "Open the bottle",
                "Look inside the cap",
                "Find the QR code printed inside",
                "Scan it with this phone's camera, within 10 minutes",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                  <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-mono">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <CountdownTimer minutes={10} />
            {result.topCode && (
              <div className="pt-3 border-t border-gray-800">
                <p className="text-[10px] font-mono text-gray-600 mb-1">
                  Top cap code for reference:
                </p>
                <p className="text-lg font-bold font-mono text-white tracking-widest">
                  {result.topCode}
                </p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-center text-gray-600">
            Powered by VerifyChain Africa
          </p>
        </div>
      )

    default:
      return null
  }
}

function StatusCard({
  icon,
  bg,
  border,
  title,
  message,
  severity,
  sub,
  badge,
}: {
  icon: ReactNode
  bg: string
  border: string
  title: string
  message: string
  severity: "success" | "warning" | "danger"
  sub?: string
  badge?: string
}) {
  return (
    <div className={`w-full max-w-sm mx-auto border rounded-2xl p-6 text-center space-y-3 ${bg} ${border}`}>
      <div className="flex justify-center">{icon}</div>
      <h1
        className={`text-lg font-bold ${
          severity === "success"
            ? "text-green-400"
            : severity === "warning"
              ? "text-yellow-400"
              : "text-red-400"
        }`}
      >
        {title}
      </h1>
      <p className="text-sm text-gray-300 leading-relaxed">{message}</p>
      {sub && <p className="text-xs font-mono text-gray-500">{sub}</p>}
      {badge && (
        <span className="inline-block text-[10px] font-mono px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
          {badge}
        </span>
      )}
      <p className="text-[11px] text-gray-700 pt-2">Powered by VerifyChain Africa</p>
    </div>
  )
}
