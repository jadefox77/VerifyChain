import { cache } from "react"
import { redirect } from "next/navigation"
import type { Manufacturer } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { can, isManufacturerRole, type Capability, type ManufacturerRole } from "@/lib/permissions"

// The company a dashboard user works in. Owners reach it through
// Manufacturer.userId; team members (factory operators, distributor
// managers, other admins) through User.teamManufacturerId. Role and company
// are read from the database on every request, never from the login token.

export type Workspace = {
  userId: string
  role: ManufacturerRole
  isOwner: boolean
  manufacturer: Manufacturer
}

export type Lookup =
  | { kind: "ok"; workspace: Workspace }
  | { kind: "signed-out" }
  | { kind: "reset-password" }
  | { kind: "not-manufacturer"; isStaff: boolean }
  | { kind: "no-company" } // owner who has not registered a company yet
  | { kind: "removed" } // team member whose company link was removed
  | { kind: "pending" }

type UserRow = {
  id: string
  role: string
  mustResetPassword: boolean
  manufacturer: Manufacturer | null
  teamManufacturer: Manufacturer | null
}

// Decides what a user may reach, from their database row. Pure, so it can
// be tested without a request.
export function resolveWorkspace(user: UserRow | null): Lookup {
  if (!user) return { kind: "signed-out" }
  if (user.mustResetPassword) return { kind: "reset-password" }
  if (!isManufacturerRole(user.role)) return { kind: "not-manufacturer", isStaff: true }

  const manufacturer = user.manufacturer ?? user.teamManufacturer
  if (!manufacturer) {
    // A user created as a team member never owns a company. Only someone who
    // signed up on their own is sent to register one.
    return user.role === "MANUFACTURER_ADMIN" ? { kind: "no-company" } : { kind: "removed" }
  }
  if (manufacturer.onboardingStatus !== "ACTIVE_PRODUCTION") return { kind: "pending" }

  return {
    kind: "ok",
    workspace: {
      userId: user.id,
      role: user.role,
      isOwner: Boolean(user.manufacturer),
      manufacturer,
    },
  }
}

// One query per request, however many checks call it.
const lookup = cache(async (userId: string): Promise<Lookup> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      mustResetPassword: true,
      manufacturer: true,
      teamManufacturer: true,
    },
  })
  return resolveWorkspace(user)
})

// For dashboard pages and server actions. Redirects when the user cannot use
// the dashboard, or lacks the capability.
export async function requireWorkspace(capability?: Capability): Promise<Workspace> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const result = await lookup(session.user.id)
  switch (result.kind) {
    case "signed-out":
      redirect("/login")
    case "reset-password":
      redirect("/auth/reset-password")
    case "not-manufacturer":
      redirect("/admin")
    case "no-company":
      redirect("/onboarding")
    case "removed":
      redirect("/unauthorized")
    case "pending":
      redirect("/onboarding/pending")
  }

  if (capability && !can(result.workspace.role, capability)) redirect("/dashboard")
  return result.workspace
}

// For API routes: null instead of a redirect.
export async function getWorkspace(capability?: Capability): Promise<Workspace | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const result = await lookup(session.user.id)
  if (result.kind !== "ok") return null
  if (capability && !can(result.workspace.role, capability)) return null
  return result.workspace
}
