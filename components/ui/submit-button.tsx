"use client"

import type { ReactNode } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

// A submit button that shows a spinner while its parent form's server action runs.
export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
}: {
  children: ReactNode
  pendingLabel?: string
  className: string
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending || disabled} className={className} aria-busy={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}
