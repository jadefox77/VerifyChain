// Small pure helpers for the fraud pipeline, kept apart so they can be tested
// without a database.

// A scan's source: its device, else its hashed IP. A scan with neither (an
// old record, or no QR_SECRET) counts as its own source, so it is never
// merged with another scan.
export function sourceKey(scan: { id: string; deviceHash: string | null; ipHash: string | null }): string {
  if (scan.deviceHash) return `device:${scan.deviceHash}`
  if (scan.ipHash) return `ip:${scan.ipHash}`
  return `scan:${scan.id}`
}

// The busiest window of windowMs in a list of times sorted oldest first:
// how many fall in it and the index of the first one.
export function busiestWindow(timesMs: number[], windowMs: number): { count: number; start: number } {
  let count = 0
  let start = 0
  let lo = 0
  for (let hi = 0; hi < timesMs.length; hi++) {
    while (timesMs[hi] - timesMs[lo] > windowMs) lo++
    if (hi - lo + 1 > count) {
      count = hi - lo + 1
      start = lo
    }
  }
  return { count, start }
}

// Bottle-and-cap taps seconds apart, with GPS a few kilometres off, must not
// look like impossible travel.
export function isImpossibleTravel(
  distKm: number,
  hoursElapsed: number,
  { minDistanceKm, maxSpeedKmh }: { minDistanceKm: number; maxSpeedKmh: number }
): boolean {
  if (distKm < minDistanceKm) return false
  if (hoursElapsed <= 0) return false
  return distKm / hoursElapsed > maxSpeedKmh
}
