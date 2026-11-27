import type { ElementType, ReactNode } from "react"

type Tone = "neutral" | "good" | "warn" | "bad"

const toneValue: Record<Tone, string> = {
  neutral: "text-gray-900 dark:text-white",
  good: "text-brand-700 dark:text-brand-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ElementType
  tone?: Tone
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${toneValue[tone]}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}
