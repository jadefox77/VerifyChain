// The list of bottles a phone scanned recently, kept in the vc_bottle cookie,
// so a cap scan can be matched against any of them (a whole crate, not only
// the last bottle). Pure functions, so they can be tested without a request.

export const BOTTLE_TTL_MS = 10 * 60 * 1000
export const MAX_RECENT_BOTTLES = 24

export type RecentBottle = { s: string; t: number }

// Parses the cookie and drops entries older than BOTTLE_TTL_MS.
export function readRecentBottles(raw: string | undefined, now = Date.now()): RecentBottle[] {
  if (!raw) return []
  if (!raw.startsWith("[")) {
    // Cookie from before the list existed: a single serial id with no time.
    // Treat it as just scanned so a check in progress is not lost.
    return /^[A-Za-z0-9-]{1,20}$/.test(raw) ? [{ s: raw, t: now }] : []
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter(
      (b): b is RecentBottle =>
        typeof b === "object" &&
        b !== null &&
        typeof (b as RecentBottle).s === "string" &&
        (b as RecentBottle).s.length <= 20 &&
        typeof (b as RecentBottle).t === "number" &&
        now - (b as RecentBottle).t < BOTTLE_TTL_MS
    )
    .slice(0, MAX_RECENT_BOTTLES)
}

// Newest first, without duplicates, so a rescan refreshes its time.
export function addRecentBottle(list: RecentBottle[], serialId: string, now = Date.now()): RecentBottle[] {
  return [{ s: serialId, t: now }, ...list.filter((b) => b.s !== serialId)].slice(0, MAX_RECENT_BOTTLES)
}
