import type { UserRole } from "@prisma/client"
import { ADMIN_ROLES } from "@/lib/admin-auth"

// Where a signed-in user should land. Sending people straight there (rather
// than to "/" and relying on the proxy) keeps the address bar correct after a
// server action redirect.
export function homePathFor(user: { role?: UserRole | string | null; mustResetPassword?: boolean | null }): string {
  if (user.mustResetPassword) return "/auth/reset-password"
  if (user.role && ADMIN_ROLES.includes(user.role as UserRole)) return "/admin"
  return "/dashboard"
}
