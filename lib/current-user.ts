import { cache } from "react"
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
