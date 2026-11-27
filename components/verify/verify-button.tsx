"use client"

import { Loader2, ShieldCheck } from "lucide-react"

export function VerifyButton({
  onClick,
  pending,
  label = "Verify this product",
  pendingLabel = "Checking",
  hint = "Your phone may ask to share your location. It helps us spot fakes, and the check still works if you say no.",
}: {
  onClick: () => void
  pending: boolean
  label?: string
  pendingLabel?: string
  hint?: string
}) {
  return (
    <div className="space-y-3 text-center">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-4 text-base font-semibold text-white transition-colors hover:bg-brand-700 active:bg-brand-800 disabled:opacity-70 dark:bg-brand-500 dark:text-gray-950 dark:hover:bg-brand-400"
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            {pendingLabel}
          </>
        ) : (
          <>
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            {label}
          </>
        )}
      </button>
      {hint && <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}
