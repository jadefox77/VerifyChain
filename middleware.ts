// =============================================================================
// VerifyChain Africa — Middleware
// Role-aware route protection for /admin and /dashboard
// =============================================================================
//
// Route protection matrix:
//
//   /admin/*                → SUPER_ADMIN, FRAUD_ANALYST, SUPPORT
//   /admin/regulatory       → SUPER_ADMIN, REGULATORY_OBSERVER
//   /admin/fraud            → SUPER_ADMIN, FRAUD_ANALYST, SUPPORT
//   /admin/users            → SUPER_ADMIN only
//   /dashboard/*            → MANUFACTURER_ADMIN, FACTORY_OPERATOR, DISTRIBUTOR_MANAGER
//   /onboarding             → authenticated (any role, pre-manufacturer creation)
//
// REGULATORY_OBSERVER can only access:
//   /admin/regulatory, /admin/analytics (read-only)
//
// Unauthenticated users are redirected to /auth/signin
// Unauthorized users (wrong role) are redirected to /unauthorized
// =============================================================================

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";

// ── Role Sets ────────────────────────────────────────────────────────────────

const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT", "REGULATORY_OBSERVER"];
const REGULATORY_ONLY_ROLES: UserRole[] = ["SUPER_ADMIN", "REGULATORY_OBSERVER"];
const FRAUD_ROLES: UserRole[] = ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"];
const SUPER_ADMIN_ONLY: UserRole[] = ["SUPER_ADMIN"];
const MANUFACTURER_ROLES: UserRole[] = ["MANUFACTURER_ADMIN", "FACTORY_OPERATOR", "DISTRIBUTOR_MANAGER"];

// Routes REGULATORY_OBSERVER is permitted to access within /admin
const REGULATORY_PERMITTED_PATHS = ["/admin/regulatory", "/admin/analytics"];

// ── Helper ───────────────────────────────────────────────────────────────────

function hasRole(userRole: UserRole | undefined, allowed: UserRole[]): boolean {
  if (!userRole) return false;
  return allowed.includes(userRole);
}

function unauthorized(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/unauthorized";
  return NextResponse.redirect(url);
}

function redirectToSignIn(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  const callbackUrl = encodeURIComponent(req.nextUrl.pathname);
  url.pathname = "/auth/signin";
  url.search = `?callbackUrl=${callbackUrl}`;
  return NextResponse.redirect(url);
}

// ── Middleware ────────────────────────────────────────────────────────────────

export default auth((req) => {
  const { nextUrl, auth: session } = req as NextRequest & { auth: { user?: { role?: UserRole } } | null };
  const pathname = nextUrl.pathname;
  const role = session?.user?.role as UserRole | undefined;

  // ── Public routes — always allowed ───────────────────────────────────────
  const publicPaths = [
    "/",
    "/auth/signin",
    "/auth/error",
    "/unauthorized",
    "/verify",
    "/api/verify",
    "/api/verify-cap",
    "/api/whatsapp",
  ];

  if (
    publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  // ── All protected routes require authentication ───────────────────────────
  if (!session?.user) {
    return redirectToSignIn(req);
  }

  // ── /admin routes ─────────────────────────────────────────────────────────

  if (pathname.startsWith("/admin")) {
    // Must have an admin-level role at minimum
    if (!hasRole(role, ADMIN_ROLES)) {
      return unauthorized(req);
    }

    // REGULATORY_OBSERVER is restricted to specific admin pages
    if (role === "REGULATORY_OBSERVER") {
      const isPermitted = REGULATORY_PERMITTED_PATHS.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );
      if (!isPermitted) {
        return unauthorized(req);
      }
      return NextResponse.next();
    }

    // /admin/users — SUPER_ADMIN only
    if (pathname.startsWith("/admin/users")) {
      if (!hasRole(role, SUPER_ADMIN_ONLY)) {
        return unauthorized(req);
      }
    }

    // /admin/fraud — fraud-capable roles
    if (pathname.startsWith("/admin/fraud")) {
      if (!hasRole(role, FRAUD_ROLES)) {
        return unauthorized(req);
      }
    }

    return NextResponse.next();
  }

  // ── /dashboard routes ─────────────────────────────────────────────────────

  if (pathname.startsWith("/dashboard")) {
    if (!hasRole(role, MANUFACTURER_ROLES)) {
      // Admin roles shouldn't be using the manufacturer dashboard
      // Redirect them to admin instead
      if (hasRole(role, ADMIN_ROLES)) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
      return unauthorized(req);
    }
    return NextResponse.next();
  }

  // ── /onboarding ───────────────────────────────────────────────────────────
  // Any authenticated user can access — but only MANUFACTURER_ADMIN role should
  // be completing this flow. Handled at page level.

  if (pathname.startsWith("/onboarding")) {
    return NextResponse.next();
  }

  return NextResponse.next();
});

// ── Matcher ───────────────────────────────────────────────────────────────────
// Apply middleware to all routes except static assets and Next.js internals

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|images|fonts).*)",
  ],
};
