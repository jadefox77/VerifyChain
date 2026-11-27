import { describe, expect, it, vi } from "vitest"
import type { Manufacturer } from "@prisma/client"

// lib/workspace imports the auth setup, which is not needed for this pure
// function, so it is replaced with a stub.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
const { resolveWorkspace } = await import("@/lib/workspace")

const company = (status = "ACTIVE_PRODUCTION") => ({ id: "m1", onboardingStatus: status }) as Manufacturer

const user = (over: Partial<Parameters<typeof resolveWorkspace>[0] & object> = {}) => ({
  id: "u1",
  role: "MANUFACTURER_ADMIN",
  mustResetPassword: false,
  manufacturer: null,
  teamManufacturer: null,
  ...over,
})

describe("resolveWorkspace", () => {
  it("lets the owner in", () => {
    const r = resolveWorkspace(user({ manufacturer: company() }))
    expect(r.kind === "ok" && r.workspace.isOwner).toBe(true)
  })

  it("lets a factory operator in through their team link", () => {
    const r = resolveWorkspace(user({ role: "FACTORY_OPERATOR", teamManufacturer: company() }))
    expect(r.kind).toBe("ok")
    if (r.kind === "ok") {
      expect(r.workspace.role).toBe("FACTORY_OPERATOR")
      expect(r.workspace.isOwner).toBe(false)
      expect(r.workspace.manufacturer.id).toBe("m1")
    }
  })

  it("locks out a removed team member instead of sending them to register a company", () => {
    expect(resolveWorkspace(user({ role: "DISTRIBUTOR_MANAGER" })).kind).toBe("removed")
  })

  it("sends a new self-signed-up user to register", () => {
    expect(resolveWorkspace(user()).kind).toBe("no-company")
  })

  it("enforces a pending password reset before anything else", () => {
    expect(resolveWorkspace(user({ mustResetPassword: true, manufacturer: company() })).kind).toBe("reset-password")
  })

  it("keeps everyone out while the company is not live", () => {
    expect(resolveWorkspace(user({ role: "FACTORY_OPERATOR", teamManufacturer: company("SUSPENDED") })).kind).toBe("pending")
  })

  it("sends staff to the admin console", () => {
    expect(resolveWorkspace(user({ role: "SUPER_ADMIN" })).kind).toBe("not-manufacturer")
  })

  it("treats a deleted account as signed out", () => {
    expect(resolveWorkspace(null).kind).toBe("signed-out")
  })
})
