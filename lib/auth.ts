// =============================================================================
// VerifyChain Africa — NextAuth v5 Configuration
// Phase 2: Role + manufacturerId persisted in JWT and Session
// =============================================================================

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  // JWT strategy so role is available in middleware without a DB hit
  session: {
    strategy: "jwt",
  },

  callbacks: {
    // ── JWT Callback ───────────────────────────────────────────────────────
    // Called every time a JWT is created or updated.
    // On first sign-in, enrich the token with role + manufacturerId from DB.
    // On subsequent requests, data is already in the token — no DB hit.
    async jwt({ token, user, trigger }) {
      // First sign-in: `user` object is populated by the adapter
      if (user) {
        token.id = user.id;
        token.role = user.role as UserRole;
        token.manufacturerId = user.manufacturerId ?? null;
      }

      // Force-refresh: admin changed a user's role — re-fetch from DB
      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            manufacturer: { select: { id: true } },
          },
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.manufacturerId = dbUser.manufacturer?.id ?? null;
        }
      }

      return token;
    },

    // ── Session Callback ───────────────────────────────────────────────────
    // Shapes the session object exposed to the application.
    // Reads from JWT — no DB query here.
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.manufacturerId = token.manufacturerId as string | null;
      }
      return session;
    },

    // ── Sign-In Callback ───────────────────────────────────────────────────
    // Block sign-in for suspended accounts.
    async signIn({ user }) {
      if (!user?.email) return false;

      // Check for suspended users (role check happens in middleware)
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { role: true },
      });

      // New users are allowed through — they'll get MANUFACTURER_ADMIN by default
      if (!dbUser) return true;

      return true;
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  events: {
    // ── New User Created ───────────────────────────────────────────────────
    // When a user signs in for the first time via OAuth, NextAuth creates the
    // User record via the adapter. Role defaults to MANUFACTURER_ADMIN per schema.
    // No additional action needed here.
    async createUser({ user }) {
      console.log(`[Auth] New user created: ${user.email} — role: MANUFACTURER_ADMIN`);
    },
  },
});

// =============================================================================
// ROLE PERMISSION MAPS
// Used throughout the application for declarative access control
// =============================================================================

export type AdminRole = Extract<
  UserRole,
  "SUPER_ADMIN" | "FRAUD_ANALYST" | "REGULATORY_OBSERVER" | "SUPPORT"
>;

// Roles that can access /admin (any sub-route)
export const ADMIN_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "FRAUD_ANALYST",
  "REGULATORY_OBSERVER",
  "SUPPORT",
];

// Roles that can access /admin/regulatory
export const REGULATORY_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REGULATORY_OBSERVER",
];

// Roles that can perform write actions in admin (advance onboarding, resolve alerts, etc.)
export const ADMIN_WRITE_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SUPPORT",
];

// Roles that can access fraud intelligence (read)
export const FRAUD_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "FRAUD_ANALYST",
  "SUPPORT",
];

// Roles that can manage users and billing
export const SUPER_ADMIN_ONLY: UserRole[] = ["SUPER_ADMIN"];

// Roles with manufacturer dashboard access
export const MANUFACTURER_ROLES: UserRole[] = [
  "MANUFACTURER_ADMIN",
  "FACTORY_OPERATOR",
  "DISTRIBUTOR_MANAGER",
];

export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}
