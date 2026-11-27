import NextAuth, { CredentialsSignin } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import type { UserRole } from "@prisma/client"
import {
  allowRequest,
  loginEmailRatelimit,
  loginIpRatelimit,
  resetLimit,
} from "@/lib/ratelimit"
import { clientIpFrom } from "@/lib/request-meta"

// Shown on the login page as ?error=CredentialsSignin&code=rate_limited.
// It says only that there were too many attempts, never whether the email
// belongs to an account.
export class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited"
}

// Shape returned by the credentials provider's authorize() below.
type AuthorizedUser = {
  role: UserRole
  mustResetPassword: boolean
  manufacturerId: string | null
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is not set")
}

if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_URL) {
  throw new Error("NEXTAUTH_URL is not set in production")
}

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
  if (!credentials?.email || !credentials?.password) return null

  // Limit password guesses. This runs inside authorize() so it also covers
  // direct POSTs to /api/auth/callback/credentials, not only the login page.
  // Per email stops guessing one account from many IPs; per IP stops one
  // source trying many accounts. If Redis is down the attempt is allowed.
  const email = String(credentials.email).trim().toLowerCase()
  const ip = clientIpFrom(request.headers)
  const [emailOk, ipOk] = await Promise.all([
    allowRequest(loginEmailRatelimit, email),
    ip === "anonymous" ? Promise.resolve(true) : allowRequest(loginIpRatelimit, ip),
  ])
  if (!emailOk || !ipOk) throw new TooManyAttempts()

  const user = await prisma.user.findUnique({
    where: { email: credentials.email as string },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      password: true,
      mustResetPassword: true,
      manufacturer: { select: { id: true } },
    },
  })

  if (!user || !user.password) return null


  const passwordMatch = await bcrypt.compare(
    credentials.password as string,
    user.password
  )

  if (!passwordMatch) return null

  // A correct password clears the count for this email, so a user who
  // mistyped a few times is not left close to the limit.
  await resetLimit(loginEmailRatelimit, email)

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    mustResetPassword: user.mustResetPassword,
    manufacturerId: user.manufacturer?.id ?? null,
  }
},
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },

  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  callbacks: {
    async jwt({ token, user, trigger, account }) {
      // Set role-based expiry on first sign-in
      if (user) {
        const isAdmin = [
          "SUPER_ADMIN",
          "FRAUD_ANALYST",
          "REGULATORY_OBSERVER",
          "SUPPORT",
        ].includes((user as AuthorizedUser).role)

        token.exp =
          Math.floor(Date.now() / 1000) +
          (isAdmin
            ? 8 * 60 * 60
            : 24 * 60 * 60 * 7)
      }

      // Fresh sign-in via OAuth
      if (account && account.provider !== "credentials") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub ?? (user?.id as string) },
          select: {
            id: true,
            role: true,
            mustResetPassword: true,
            manufacturer: { select: { id: true } },
          },
        })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.mustResetPassword = dbUser.mustResetPassword
          token.manufacturerId = dbUser.manufacturer?.id ?? null
        }
      }

      // Fresh sign-in via credentials
      if (user && account?.provider === "credentials") {
        token.id = user.id ?? ""
        const u = user as AuthorizedUser
        token.role = u.role
        token.mustResetPassword = u.mustResetPassword
        token.manufacturerId = u.manufacturerId ?? null
      }

      // Force refresh
      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            mustResetPassword: true,
            manufacturer: { select: { id: true } },
          },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.mustResetPassword = dbUser.mustResetPassword
          token.manufacturerId = dbUser.manufacturer?.id ?? null
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.manufacturerId =
          token.manufacturerId as string | null
        session.user.mustResetPassword =
          (token.mustResetPassword as boolean) ?? false
      }
      return session
    },

    async signIn({ user }) {
      if (!user?.email) return false
      return true
    },
  },

  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
})

// Role permission maps

export const ADMIN_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "FRAUD_ANALYST",
  "REGULATORY_OBSERVER",
  "SUPPORT",
]

export const ADMIN_WRITE_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPPORT"]
export const FRAUD_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "FRAUD_ANALYST",
  "SUPPORT",
]
export const SUPER_ADMIN_ONLY: UserRole[] = ["SUPER_ADMIN"]
export const MANUFACTURER_ROLES: UserRole[] = [
  "MANUFACTURER_ADMIN",
  "FACTORY_OPERATOR",
  "DISTRIBUTOR_MANAGER",
]

export function hasRole(
  userRole: UserRole,
  allowedRoles: UserRole[]
): boolean {
  return allowedRoles.includes(userRole)
}