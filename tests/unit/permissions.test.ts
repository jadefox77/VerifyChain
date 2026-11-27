import { describe, expect, it } from "vitest"
import { can, isManufacturerRole, MANUFACTURER_ROLE_LIST } from "@/lib/permissions"
import { parseNewMember } from "@/lib/team"

describe("dashboard permissions", () => {
  it("gives a manufacturer admin everything", () => {
    for (const cap of ["manageProducts", "createBatches", "viewBilling", "manageTeam"] as const) {
      expect(can("MANUFACTURER_ADMIN", cap)).toBe(true)
    }
  })

  it("lets a factory operator make and download batches, but not see billing or the team", () => {
    expect(can("FACTORY_OPERATOR", "createBatches")).toBe(true)
    expect(can("FACTORY_OPERATOR", "exportBatches")).toBe(true)
    expect(can("FACTORY_OPERATOR", "viewBilling")).toBe(false)
    expect(can("FACTORY_OPERATOR", "manageTeam")).toBe(false)
    expect(can("FACTORY_OPERATOR", "manageProducts")).toBe(false)
  })

  it("keeps a distributor manager read-only", () => {
    expect(can("DISTRIBUTOR_MANAGER", "viewScans")).toBe(true)
    expect(can("DISTRIBUTOR_MANAGER", "viewFraud")).toBe(true)
    expect(can("DISTRIBUTOR_MANAGER", "createBatches")).toBe(false)
    expect(can("DISTRIBUTOR_MANAGER", "exportBatches")).toBe(false)
  })

  it("gives staff roles and unknown values nothing in the dashboard", () => {
    expect(can("SUPER_ADMIN", "viewBatches")).toBe(false)
    expect(can(undefined, "viewBatches")).toBe(false)
    expect(isManufacturerRole("SUPPORT")).toBe(false)
    expect(MANUFACTURER_ROLE_LIST).toHaveLength(3)
  })
})

describe("parseNewMember", () => {
  it("tidies a valid entry and lower-cases the email", () => {
    expect(parseNewMember({ name: "  Ada ", email: " Ada@Example.COM ", role: "FACTORY_OPERATOR" })).toEqual({
      ok: true,
      value: { name: "Ada", email: "ada@example.com", role: "FACTORY_OPERATOR" },
    })
  })

  it("refuses staff roles, so a manufacturer cannot create a super admin", () => {
    expect(parseNewMember({ name: "A", email: "a@b.co", role: "SUPER_ADMIN" })).toEqual({ ok: false, error: "bad_role" })
  })

  it("refuses missing fields and bad emails", () => {
    expect(parseNewMember({ name: "", email: "a@b.co", role: "FACTORY_OPERATOR" })).toEqual({ ok: false, error: "missing" })
    expect(parseNewMember({ name: "A", email: "not-an-email", role: "FACTORY_OPERATOR" })).toEqual({
      ok: false,
      error: "bad_email",
    })
  })
})
