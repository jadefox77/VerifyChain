import { describe, expect, it } from "vitest"
import { busiestWindow, isImpossibleTravel, sourceKey } from "@/lib/fraud-math"

const RULE = { minDistanceKm: 50, maxSpeedKmh: 500 }

describe("isImpossibleTravel", () => {
  it("ignores a 5 km GPS wobble between bottle and cap taps 20 seconds apart", () => {
    // 5 km in 20 s is 900 km/h, which used to raise a CRITICAL alert.
    expect(isImpossibleTravel(5, 20 / 3600, RULE)).toBe(false)
  })

  it("flags Lagos to Kano in 30 minutes", () => {
    expect(isImpossibleTravel(830, 0.5, RULE)).toBe(true)
  })

  it("allows Lagos to Kano over two days", () => {
    expect(isImpossibleTravel(830, 48, RULE)).toBe(false)
  })

  it("ignores scans with no time between them", () => {
    expect(isImpossibleTravel(830, 0, RULE)).toBe(false)
  })
})

describe("busiestWindow", () => {
  const MIN = 60_000

  it("finds a burst anywhere in the day, not only at the end", () => {
    const burst = Array.from({ length: 60 }, (_, i) => 5 * 60 * MIN + i * 1500)
    const times = [0, 10 * MIN, ...burst, 20 * 60 * MIN]
    const { count, start } = busiestWindow(times, 2 * MIN)
    expect(count).toBe(60)
    expect(times[start]).toBe(burst[0])
  })

  it("counts scans exactly on the window edge", () => {
    expect(busiestWindow([0, 2 * MIN], 2 * MIN).count).toBe(2)
    expect(busiestWindow([0, 2 * MIN + 1], 2 * MIN).count).toBe(1)
  })

  it("handles an empty list", () => {
    expect(busiestWindow([], 2 * MIN)).toEqual({ count: 0, start: 0 })
  })
})

describe("sourceKey", () => {
  it("prefers the device, then the IP, then the scan itself", () => {
    expect(sourceKey({ id: "1", deviceHash: "d", ipHash: "i" })).toBe("device:d")
    expect(sourceKey({ id: "1", deviceHash: null, ipHash: "i" })).toBe("ip:i")
    expect(sourceKey({ id: "1", deviceHash: null, ipHash: null })).toBe("scan:1")
  })
})
