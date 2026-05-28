"use client"

import { useState, useEffect } from "react"

export function CountdownTimer({ minutes = 10 }: { minutes?: number }) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (secondsLeft <= 0) {
      setExpired(true)
      return
    }

    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setExpired(true)
          clearInterval(timer)
          return 0
        }
        return s - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  if (expired) {
    return (
      <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
        <span className="text-red-400 text-sm">⏱</span>
        <p className="text-xs text-red-400">
          <strong>Session expired.</strong> Please scan the bottle QR again to restart.
        </p>
      </div>
    )
  }

  const isUrgent = secondsLeft <= 60
  const isWarning = secondsLeft <= 180

  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
        isUrgent
          ? "bg-red-500/10 border-red-500/20"
          : isWarning
          ? "bg-orange-500/10 border-orange-500/20"
          : "bg-yellow-500/5 border-yellow-500/20"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-sm ${
            isUrgent
              ? "text-red-400"
              : isWarning
              ? "text-orange-400"
              : "text-yellow-400"
          }`}
        >
          ⏱
        </span>
        <p
          className={`text-xs ${
            isUrgent
              ? "text-red-400"
              : isWarning
              ? "text-orange-400"
              : "text-yellow-400"
          }`}
        >
          {isUrgent
            ? "Hurry! Session expiring soon"
            : "Time remaining to scan cap"}
        </p>
      </div>
      <span
        className={`text-sm font-bold font-mono ${
          isUrgent
            ? "text-red-400"
            : isWarning
            ? "text-orange-400"
            : "text-yellow-400"
        }`}
      >
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  )
}