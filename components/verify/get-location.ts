"use client"

export type Coords = { lat: number; lng: number } | null

// Ask for the phone's location, but never block verification on it.
// If the user declines, or it takes too long, verify without location.
export function getLocation(timeoutMs = 6000): Promise<Coords> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null)
      return
    }

    let done = false
    const finish = (value: Coords) => {
      if (done) return
      done = true
      resolve(value)
    }

    const timer = setTimeout(() => finish(null), timeoutMs + 500)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        finish({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        clearTimeout(timer)
        finish(null)
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
    )
  })
}
