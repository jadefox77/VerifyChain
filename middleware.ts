import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

type UserRole =
  | "SUPER_ADMIN"
  | "MANUFACTURER_ADMIN"
  | "FACTORY_OPERATOR"
  | "FRAUD_ANALYST"
  | "REGULATORY_OBSERVER"
  | "DISTRIBUTOR_MANAGER"
  | "SUPPORT"

const ADMIN_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "FRAUD_ANALYST",
  "REGULATORY_OBSERVER",
  "SUPPORT",
]

const REGULATORY_PERMITTED_PATHS = ["/admin/regulatory", "/admin/analytics"]
const FRAUD_ROLES: UserRole[] = ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"]
const SUPER_ADMIN_ONLY: UserRole[] = ["SUPER_ADMIN"]
const MANUFACTURER_ROLES: UserRole[] = [
  "MANUFACTURER_ADMIN",
  "FACTORY_OPERATOR",
  "DISTRIBUTOR_MANAGER",
]

function hasRole(role: UserRole | undefined, allowed: UserRole[]): boolean {
  if (!role) return false
  return allowed.includes(role)
}

function unauthorized(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = "/unauthorized"
  return NextResponse.redirect(url)
}

function redirectToSignIn(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = "/login"
  return NextResponse.redirect(url)
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Public paths — skip all checks
  const publicPaths = [
    "/",
    "/login",
    "/unauthorized",
    "/verify",
    "/api/verify",
    "/api/verify-cap",
    "/api/whatsapp",
    "/api/auth",
  ]

  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next()
  }

  // Read role directly from JWT — no DB, no Prisma, edge-safe
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
  })
console.log("[middleware]", pathname, "token:", token ? "present" : "null", "role:", token?.role)
  

  const role = token?.role as UserRole | undefined

  if (!token) {
    return redirectToSignIn(req)
  }

  // /admin routes
  if (pathname.startsWith("/admin")) {
    if (!hasRole(role, ADMIN_ROLES)) {
      return unauthorized(req)
    }

    if (role === "REGULATORY_OBSERVER") {
      const isPermitted = REGULATORY_PERMITTED_PATHS.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      )
      if (!isPermitted) return unauthorized(req)
      return NextResponse.next()
    }

    if (pathname.startsWith("/admin/users")) {
      if (!hasRole(role, SUPER_ADMIN_ONLY)) return unauthorized(req)
    }

    if (pathname.startsWith("/admin/fraud")) {
      if (!hasRole(role, FRAUD_ROLES)) return unauthorized(req)
    }

    return NextResponse.next()
  }

  // /dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!hasRole(role, MANUFACTURER_ROLES)) {
      if (hasRole(role, ADMIN_ROLES)) {
        const url = req.nextUrl.clone()
        url.pathname = "/admin"
        return NextResponse.redirect(url)
      }
      return unauthorized(req)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|images|fonts).*)",
  ],
}