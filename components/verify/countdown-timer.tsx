"use client"

import { useEffect, useState } from "react"
import { Timer } from "lucide-react"

export function CountdownTimer({ minutes = 10 }: { minutes?: number }) {
  const [deadline] = useState(() => Date.now() + minutes * 60 * 1000)
  const [now, setNow] = useState(() => Date.now())

  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000))
  const expired = secondsLeft === 0

  useEffect(() => {
    if (expired) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expired])

  if (expired) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <Timer className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <span className="font-semibold">Time is up.</span> Scan the bottle label again to restart the check.
        </p>
      </div>
    )
  }

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const urgent = secondsLeft <= 60

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
        urgent
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
          : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200"
      }`}
    >
      <span className="flex items-center gap-2">
        <Timer className="h-4 w-4" aria-hidden="true" />
        {urgent ? "Less than a minute left" : "Time left to scan the cap"}
      </span>
      <span className="font-mono font-semibold tabular-nums" aria-live="off">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  )
}
