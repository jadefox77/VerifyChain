import type { ReactNode } from "react"

export type BadgeTone = "neutral" | "brand" | "info" | "warn" | "bad" | "violet"

const tones: Record<BadgeTone, string> = {
  neutral:
    "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
  brand:
    "bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/25",
  info: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25",
  warn: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
  bad: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25",
  violet:
    "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25",
}

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
