import type { ReactNode } from "react"
import { CheckCircle2, CircleHelp, Clock, TriangleAlert, XCircle } from "lucide-react"

export type ResultTone = "good" | "warn" | "bad" | "neutral" | "wait"

const TONES: Record<
  ResultTone,
  { box: string; icon: string; title: string; body: string; Icon: typeof CheckCircle2 }
> = {
  // Fixed green, not the brand-* scale, so a brand page cannot recolour a pass.
  good: {
    box: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
    title: "text-emerald-900 dark:text-emerald-100",
    body: "text-emerald-900/80 dark:text-emerald-100/80",
    Icon: CheckCircle2,
  },
  warn: {
    box: "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
    title: "text-amber-900 dark:text-amber-100",
    body: "text-amber-900/80 dark:text-amber-100/80",
    Icon: TriangleAlert,
  },
  bad: {
    box: "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10",
    icon: "text-red-600 dark:text-red-400",
    title: "text-red-900 dark:text-red-100",
    body: "text-red-900/80 dark:text-red-100/80",
    Icon: XCircle,
  },
  neutral: {
    box: "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
    icon: "text-gray-500 dark:text-gray-400",
    title: "text-gray-900 dark:text-white",
    body: "text-gray-600 dark:text-gray-300",
    Icon: CircleHelp,
  },
  wait: {
    box: "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
    icon: "text-gray-500 dark:text-gray-400",
    title: "text-gray-900 dark:text-white",
    body: "text-gray-600 dark:text-gray-300",
    Icon: Clock,
  },
}

export function ResultCard({
  tone,
  title,
  message,
  details,
  note,
  children,
}: {
  tone: ResultTone
  title: string
  message: string
  details?: { label: string; value: string }[]
  note?: ReactNode
  children?: ReactNode
}) {
  const t = TONES[tone]
  return (
    <section
      role={tone === "bad" || tone === "warn" ? "alert" : "status"}
      className={`rounded-2xl border p-6 text-center ${t.box}`}
    >
      <t.Icon className={`mx-auto h-11 w-11 ${t.icon}`} aria-hidden="true" />
      <h1 className={`mt-3 text-xl font-semibold tracking-tight ${t.title}`}>{title}</h1>
      <p className={`mt-2 text-sm leading-relaxed ${t.body}`}>{message}</p>

      {details && details.length > 0 && (
        <dl className="mt-5 space-y-2 rounded-xl bg-white/70 p-4 text-left text-sm dark:bg-gray-950/40">
          {details.map((d) => (
            <div key={d.label} className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">{d.label}</dt>
              <dd className="text-right font-medium text-gray-900 dark:text-white">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children}

      {note && <p className={`mt-4 text-xs leading-relaxed ${t.body}`}>{note}</p>}
    </section>
  )
}

/** Shown under warning and failure results. */
export function WhatToDo() {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
      <p className="font-medium text-gray-900 dark:text-white">What you can do</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Do not drink or use the product.</li>
        <li>Keep the bottle, cap and receipt if you have them.</li>
        <li>Tell the seller, and contact the brand using the details on the label.</li>
      </ul>
    </div>
  )
}
