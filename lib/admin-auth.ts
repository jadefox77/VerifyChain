// =============================================================================
// VerifyChain Africa — Admin Auth Utilities
// Server-side RBAC helpers for use in Server Components and API routes
// =============================================================================
//
// Usage in Server Components:
//
//   import { requireAdmin, requireSuperAdmin } from "@/lib/admin-auth"
//
//   export default async function AdminPage() {
//     const session = await requireAdmin()   // throws redirect if unauthorized
//     // session.user.role is now typed and validated
//   }
//
// Usage in API routes:
//
//   import { getAdminSession, canWrite } from "@/lib/admin-auth"
//
//   export async function POST(req: Request) {
//     const session = await getAdminSession()
//     if (!session || !canWrite(session.user.role)) {
//       return Response.json({ error: "Unauthorized" }, { status: 403 })
//     }
//   }
//
// =============================================================================

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import type { Session } from "next-auth";

// ── Role Sets ────────────────────────────────────────────────────────────────

export const ADMIN_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "FRAUD_ANALYST",
  "REGULATORY_OBSERVER",
  "SUPPORT",
];

export const WRITE_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPPORT"];
export const FRAUD_ROLES: UserRole[] = ["SUPER_ADMIN", "FRAUD_ANALYST", "SUPPORT"];
export const REGULATORY_ROLES: UserRole[] = ["SUPER_ADMIN", "REGULATORY_OBSERVER"];
export const SUPER_ADMIN_ONLY: UserRole[] = ["SUPER_ADMIN"];

// ── Type: Admin Session ───────────────────────────────────────────────────────

export type AdminSession = Session & {
  user: Session["user"] & {
    id: string;
    role: UserRole;
  };
};

// ── Core Helper ───────────────────────────────────────────────────────────────

function hasRole(role: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(role);
}

// ── getAdminSession ───────────────────────────────────────────────────────────
// Returns the session if the user has any admin role.
// Returns null if unauthenticated or wrong role.
// Use in API routes.

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth();
  if (!session?.user?.role) return null;
  if (!hasRole(session.user.role as UserRole, ADMIN_ROLES)) return null;
  return session as AdminSession;
}

// ── requireAdmin ─────────────────────────────────────────────────────────────
// Use in Server Components that any admin role can access.
// Redirects to /unauthorized if the user doesn't qualify.

export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (!hasRole(session.user.role as UserRole, ADMIN_ROLES)) {
    redirect("/unauthorized");
  }

  return session as AdminSession;
}

// ── requireSuperAdmin ─────────────────────────────────────────────────────────
// Use in Server Components that only SUPER_ADMIN can access (e.g., /admin/users).

export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (!hasRole(session.user.role as UserRole, SUPER_ADMIN_ONLY)) {
    redirect("/unauthorized");
  }

  return session as AdminSession;
}

// ── requireFraudAnalyst ───────────────────────────────────────────────────────
// Use in Server Components for fraud intelligence pages.

export async function requireFraudAccess(): Promise<AdminSession> {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (!hasRole(session.user.role as UserRole, FRAUD_ROLES)) {
    redirect("/unauthorized");
  }

  return session as AdminSession;
}

// ── requireRegulatoryAccess ───────────────────────────────────────────────────
// Use in Server Components for the regulatory view.

export async function requireRegulatoryAccess(): Promise<AdminSession> {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (!hasRole(session.user.role as UserRole, REGULATORY_ROLES)) {
    redirect("/unauthorized");
  }

  return session as AdminSession;
}

// ── Permission Predicates ─────────────────────────────────────────────────────
// Use these for conditional UI rendering within components.

export function canWrite(role: UserRole): boolean {
  return hasRole(role, WRITE_ROLES);
}

export function canManageUsers(role: UserRole): boolean {
  return hasRole(role, SUPER_ADMIN_ONLY);
}

export function canViewFraud(role: UserRole): boolean {
  return hasRole(role, FRAUD_ROLES);
}

export function canViewRegulatory(role: UserRole): boolean {
  return hasRole(role, REGULATORY_ROLES);
}

export function isManufacturerRole(role: UserRole): boolean {
  return ["MANUFACTURER_ADMIN", "FACTORY_OPERATOR", "DISTRIBUTOR_MANAGER"].includes(role);
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

// ── Role Display Helpers ─────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  MANUFACTURER_ADMIN: "Manufacturer Admin",
  FACTORY_OPERATOR: "Factory Operator",
  FRAUD_ANALYST: "Fraud Analyst",
  REGULATORY_OBSERVER: "Regulatory Observer",
  DISTRIBUTOR_MANAGER: "Distributor Manager",
  SUPPORT: "Support",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPER_ADMIN: "Full platform access — VerifyChain staff only",
  MANUFACTURER_ADMIN: "Full access to manufacturer tenant workspace",
  FACTORY_OPERATOR: "Production line access — limited write permissions",
  FRAUD_ANALYST: "Read access to fraud intelligence and alert management",
  REGULATORY_OBSERVER: "Read-only access to regulatory and analytics views",
  DISTRIBUTOR_MANAGER: "Scoped read access to distribution and scan data",
  SUPPORT: "Read access and manufacturer management — VerifyChain support",
};

export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
  MANUFACTURER_ADMIN: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  FACTORY_OPERATOR: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  FRAUD_ANALYST: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  REGULATORY_OBSERVER: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  DISTRIBUTOR_MANAGER: "bg-green-500/20 text-green-400 border-green-500/30",
  SUPPORT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};
