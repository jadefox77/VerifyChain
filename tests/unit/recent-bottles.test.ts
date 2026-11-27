import { describe, expect, it } from "vitest"
import {
  BOTTLE_TTL_MS,
  MAX_RECENT_BOTTLES,
  addRecentBottle,
  readRecentBottles,
} from "@/lib/recent-bottles"

const NOW = 1_800_000_000_000

describe("recent bottles cookie", () => {
  it("keeps a whole crate, newest first", () => {
    let list = readRecentBottles(undefined, NOW)
    for (const s of ["B1", "B2", "B3"]) list = addRecentBottle(list, s, NOW)
    expect(list.map((b) => b.s)).toEqual(["B3", "B2", "B1"])
  })

  it("moves a rescanned bottle to the front without duplicating it", () => {
    let list = addRecentBottle([], "B1", NOW)
    list = addRecentBottle(list, "B2", NOW)
    list = addRecentBottle(list, "B1", NOW + 1000)
    expect(list.map((b) => b.s)).toEqual(["B1", "B2"])
    expect(list[0].t).toBe(NOW + 1000)
  })

  it("round-trips through JSON and drops entries older than 10 minutes", () => {
    const raw = JSON.stringify([
      { s: "FRESH", t: NOW - 1000 },
      { s: "OLD", t: NOW - BOTTLE_TTL_MS - 1 },
    ])
    expect(readRecentBottles(raw, NOW).map((b) => b.s)).toEqual(["FRESH"])
  })

  it("caps the list length", () => {
    let list = addRecentBottle([], "X0", NOW)
    for (let i = 1; i < 40; i++) list = addRecentBottle(list, `X${i}`, NOW)
    expect(list).toHaveLength(MAX_RECENT_BOTTLES)
    expect(list[0].s).toBe("X39")
  })

  it("reads the old single-serial cookie", () => {
    expect(readRecentBottles("ABCD2345EFGH", NOW)).toEqual([{ s: "ABCD2345EFGH", t: NOW }])
  })

  it("ignores tampered or malformed cookies", () => {
    expect(readRecentBottles("[not json", NOW)).toEqual([])
    expect(readRecentBottles('{"s":"B1"}', NOW)).toEqual([])
    expect(readRecentBottles(JSON.stringify([{ s: 5, t: NOW }, { s: "x".repeat(30), t: NOW }]), NOW)).toEqual([])
    expect(readRecentBottles("<script>", NOW)).toEqual([])
  })
})
