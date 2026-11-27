import { describe, expect, it } from "vitest"
import { NIGERIAN_STATES } from "@/lib/nigeria"
import { DRIFT_RADIUS_KM, haversineKm, regionCoords } from "@/lib/regions"

describe("regionCoords", () => {
  it("has coordinates for every state the batch form offers", () => {
    const missing = NIGERIAN_STATES.filter((s) => regionCoords(s.value) === null).map((s) => s.value)
    expect(missing).toEqual([])
    expect(NIGERIAN_STATES).toHaveLength(37)
  })

  it("accepts older spellings of the FCT", () => {
    const abuja = regionCoords("Abuja")
    expect(abuja).not.toBeNull()
    expect(regionCoords("FCT")).toEqual(abuja)
    expect(regionCoords("FCT (Abuja)")).toEqual(abuja)
    expect(regionCoords(" Lagos ")).toEqual(regionCoords("Lagos"))
  })

  it("returns null for unknown or empty regions", () => {
    expect(regionCoords("Atlantis")).toBeNull()
    expect(regionCoords(null)).toBeNull()
    expect(regionCoords("")).toBeNull()
  })
})

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(6.5, 3.4, 6.5, 3.4)).toBe(0)
  })

  it("puts Lagos to Kano at roughly 830 km", () => {
    const lagos = regionCoords("Lagos")!
    const kano = regionCoords("Kano")!
    const km = haversineKm(lagos.lat, lagos.lng, kano.lat, kano.lng)
    expect(km).toBeGreaterThan(780)
    expect(km).toBeLessThan(880)
    expect(km).toBeGreaterThan(DRIFT_RADIUS_KM)
  })
})
