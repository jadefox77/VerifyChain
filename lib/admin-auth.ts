// Server-side role checks for admin pages, server actions and API routes.
// requireAdmin() and friends redirect when the check fails; getAdminSession()
// returns null so API routes can answer with 401 or 403 themselves.

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import type { Session } from "next-auth";
import { getCurrentUser } from "@/lib/current-user";

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

// ── Fresh session ────────────────────────────────────────────────────────────
// The session's role comes from the login token, which can be hours old. Every
// check below replaces it with the role in the database, so a role change or
// removal applies on the next request instead of when the token expires.

type FreshSession =
  | { kind: "ok"; session: AdminSession; mustResetPassword: boolean }
  | { kind: "signed-out" };

async function freshSession(): Promise<FreshSession> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session?.user || !userId) return { kind: "signed-out" };

  const user = await getCurrentUser(userId);
  // The account was deleted after this token was issued.
  if (!user) return { kind: "signed-out" };

  session.user.role = user.role;
  session.user.mustResetPassword = user.mustResetPassword;
  return {
    kind: "ok",
    session: session as AdminSession,
    mustResetPassword: user.mustResetPassword,
  };
}

// ── getAdminSession ───────────────────────────────────────────────────────────
// Returns the session if the user has any admin role.
// Returns null if unauthenticated, wrong role, or still on a temporary
// password. Use in API routes.

export async function getAdminSession(): Promise<AdminSession | null> {
  const fresh = await freshSession();
  if (fresh.kind !== "ok") return null;
  if (fresh.mustResetPassword) return null;
  if (!hasRole(fresh.session.user.role, ADMIN_ROLES)) return null;
  return fresh.session;
}

// ── requireRole ──────────────────────────────────────────────────────────────
// Shared by the require* helpers below, for Server Components and server
// actions. Redirects to /login, /auth/reset-password or /unauthorized.

async function requireRole(allowed: UserRole[]): Promise<AdminSession> {
  const fresh = await freshSession();
  if (fresh.kind !== "ok") redirect("/login");
  if (fresh.mustResetPassword) redirect("/auth/reset-password");
  if (!hasRole(fresh.session.user.role, allowed)) redirect("/unauthorized");
  return fresh.session;
}

// Any admin role.
export async function requireAdmin(): Promise<AdminSession> {
  return requireRole(ADMIN_ROLES);
}

// Only SUPER_ADMIN (e.g., /admin/users).
export async function requireSuperAdmin(): Promise<AdminSession> {
  return requireRole(SUPER_ADMIN_ONLY);
}

// Fraud intelligence pages.
export async function requireFraudAccess(): Promise<AdminSession> {
  return requireRole(FRAUD_ROLES);
}

// The regulatory view.
export async function requireRegulatoryAccess(): Promise<AdminSession> {
  return requireRole(REGULATORY_ROLES);
}

// ── Permission Predicates ─────────────────────────────────────────────────────
// Use these for conditional UI rendering within components.

export function canWrite(role: UserRole): boolean {
  return hasRole(role, WRITE_ROLES);
}

// Resolving an alert is part of the fraud team's job, so analysts can do it
// as well as the roles that can write elsewhere.
export function canResolveAlerts(role: UserRole): boolean {
  return hasRole(role, FRAUD_ROLES);
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
  SUPER_ADMIN: "Full platform access. VerifyChain staff only.",
  MANUFACTURER_ADMIN: "Full access to their own company workspace",
  FACTORY_OPERATOR: "Production line access with limited write permissions",
  FRAUD_ANALYST: "Fraud data, and can resolve alerts",
  REGULATORY_OBSERVER: "Read-only access to regulatory and analytics pages",
  DISTRIBUTOR_MANAGER: "Read access to distribution and scan data",
  SUPPORT: "Read access plus manufacturer management. VerifyChain support staff.",
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
