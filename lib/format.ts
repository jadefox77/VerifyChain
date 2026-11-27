const LAGOS = "Africa/Lagos"

export function formatDate(date: Date | string, withTime = false): string {
  return new Date(date).toLocaleString("en-NG", {
    timeZone: LAGOS,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-NG", {
    timeZone: LAGOS,
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function timeAgo(date: Date | string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000))
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`
  const days = Math.floor(seconds / 86400)
  return days === 1 ? "1 day ago" : `${days} days ago`
}

/** "PENDING_REVIEW" -> "Pending review" */
export function humanize(value: string): string {
  const s = value.replace(/_/g, " ").toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`
}
