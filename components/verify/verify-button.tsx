"use client"

import { ShieldCheck, Loader2 } from "lucide-react"

export function VerifyButton({
  onClick,
  pending,
  label = "Tap to verify",
  hint = "We'll ask for your location to help catch fakes. You can say no.",
}: {
  onClick: () => void
  pending: boolean
  label?: string
  hint?: string
}) {
  return (
    <div className="w-full max-w-sm mx-auto space-y-3 text-center">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold py-4 text-base transition-colors"
      >
        {pending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Verifying…
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5" />
            {label}
          </>
        )}
      </button>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  )
}
