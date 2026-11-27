// Day and month boundaries in Lagos time (West Africa Time, UTC+1, no daylight
// saving), so "today" on dashboards matches the clock in Nigeria wherever the
// server runs.

const OFFSET_MS = 60 * 60 * 1000

export function startOfLagosDay(date = new Date(), addDays = 0): Date {
  const lagos = new Date(date.getTime() + OFFSET_MS)
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() + addDays) - OFFSET_MS)
}

export function startOfLagosMonth(date = new Date()): Date {
  const lagos = new Date(date.getTime() + OFFSET_MS)
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1) - OFFSET_MS)
}

// "YYYY-MM-DD" for the Lagos calendar day that contains this instant. Matches
// the keys produced by LAGOS_DAY_SQL below.
export function lagosDayKey(date: Date): string {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}

// The last `count` Lagos days, oldest first, each with its start instant and key.
export function lastLagosDays(count: number, now = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const start = startOfLagosDay(now, i - (count - 1))
    return { start, key: lagosDayKey(start) }
  })
}

// The last `count` Lagos calendar months, oldest first. `key` is "YYYY-MM".
export function lastLagosMonths(count: number, now = new Date()) {
  const lagos = new Date(now.getTime() + OFFSET_MS)
  const y = lagos.getUTCFullYear()
  const m = lagos.getUTCMonth()
  return Array.from({ length: count }, (_, i) => {
    const first = new Date(Date.UTC(y, m - (count - 1 - i), 1))
    return { start: new Date(first.getTime() - OFFSET_MS), key: first.toISOString().slice(0, 7) }
  })
}
