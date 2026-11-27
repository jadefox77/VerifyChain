import type { BadgeTone } from "@/components/ui/badge"

export const SEVERITY: Record<string, { label: string; tone: BadgeTone }> = {
  SAFE: { label: "Informational", tone: "neutral" },
  SUSPICIOUS: { label: "Suspicious", tone: "warn" },
  HIGH_CONCERN: { label: "High concern", tone: "bad" },
  CRITICAL: { label: "Critical", tone: "bad" },
}

export const ALERT_TYPE_LABELS: Record<string, string> = {
  INVALID_PAIRING: "Cap and bottle mismatch",
  MASS_CLONING: "Copied codes",
  GEOGRAPHIC_TELEPORTATION: "Impossible travel",
  SUPPLY_CHAIN_DRIFT: "Outside target state",
  REPEAT_SCAN_ABUSE: "Repeat scans",
  BOT_ACTIVITY: "Automated scanning",
  REFILL_DETECTED: "Possible refill",
  PRODUCTION_PAIRING_FAIL: "Production pairing failure",
  SUSPICIOUS_RETAIL_CLUSTER: "Retail cluster",
  IDENTITY_EXHAUSTION: "Code probing",
}
