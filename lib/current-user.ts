import { cache } from "react"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import type { UserRole } from "@prisma/client"

export type CurrentUser = {
  id: string
  role: UserRole
  mustResetPassword: boolean
}

// The role and password-reset flag as they are in the database right now.
// The login token keeps a copy from sign-in, which can be up to 8 hours old
// for staff and 7 days for manufacturers, so access checks read this instead.
// A removed admin loses access on their next request.
// cache() makes it one query per request, however many checks call it.
export const getCurrentUser = cache(
  async (userId: string): Promise<CurrentUser | null> => {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, mustResetPassword: true },
    })
  }
)

const MANUFACTURER_ROLES: UserRole[] = [
  "MANUFACTURER_ADMIN",
  "FACTORY_OPERATOR",
  "DISTRIBUTOR_MANAGER",
]

// For dashboard server actions, which do not pass through the dashboard
// layout. Redirects unless the user, as stored now, has a manufacturer role
// and no pending password reset.
export async function requireManufacturerUser(userId: string): Promise<CurrentUser> {
  const user = await getCurrentUser(userId)
  if (!user) redirect("/login")
  if (user.mustResetPassword) redirect("/auth/reset-password")
  if (!MANUFACTURER_ROLES.includes(user.role)) redirect("/unauthorized")
  return user
}
