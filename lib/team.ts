import crypto from "crypto"
import { isManufacturerRole, type ManufacturerRole } from "@/lib/permissions"

// XXXX-XXXX, easy to read out over the phone. The user must change it the
// first time they sign in.
export function makeTempPassword(): string {
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

export type NewMemberInput = {
  name: string
  email: string
  role: ManufacturerRole
}

export type NewMemberError = "missing" | "bad_email" | "bad_role"

// Checks and tidies the add-member form. Emails are stored lower case.
export function parseNewMember(form: {
  name: unknown
  email: unknown
  role: unknown
}): { ok: true; value: NewMemberInput } | { ok: false; error: NewMemberError } {
  const name = String(form.name ?? "").trim().slice(0, 120)
  const email = String(form.email ?? "").trim().toLowerCase().slice(0, 254)
  const role = String(form.role ?? "")
  if (!name || !email) return { ok: false, error: "missing" }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "bad_email" }
  if (!isManufacturerRole(role)) return { ok: false, error: "bad_role" }
  return { ok: true, value: { name, email, role } }
}
