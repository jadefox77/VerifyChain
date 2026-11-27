"use client"

import { useState } from "react"
import { Play, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

type PipelineResult = {
  ran_at: string
  duration_ms: number
  alerts_created: number
  manufacturers_updated: number
  checks: {
    velocity: number
    teleportation: number
    drift: number
    bot: number
    fraud_rates: number
  }
}

export function FraudPipelineTrigger() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runPipeline() {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch("/api/fraud/analyze", {
        method: "POST",
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Pipeline failed")
        return
      }

      setResult(data.result)
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={runPipeline}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
        {loading ? "Running checks" : "Run fraud checks now"}
      </button>

      {/* Result summary */}
      {result && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
          <span className="text-xs text-green-400">
            {result.alerts_created} alerts created ·{" "}
            {result.manufacturers_updated} manufacturers updated ·{" "}
            {result.duration_ms}ms
          </span>
        </div>
      )}

      {/* Detailed result */}
      {result && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>velocity: {result.checks.velocity}</span>
          <span>teleport: {result.checks.teleportation}</span>
          <span>drift: {result.checks.drift}</span>
          <span>bot: {result.checks.bot}</span>
          <span>rates: {result.checks.fraud_rates}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
          <span className="text-xs text-red-400">
            {error}
          </span>
        </div>
      )}
    </div>
  )
}