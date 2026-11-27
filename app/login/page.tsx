import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"
import { auth, signIn, TooManyAttempts } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { homePathFor } from "@/lib/home-path"
import { AuthCard, AuthShell, Notice } from "@/components/ui/auth-shell"
import { GoogleIcon } from "@/components/ui/google-icon"
import { SubmitButton } from "@/components/ui/submit-button"
import { buttonPrimary, buttonSecondary, fieldLabel, inputBase } from "@/lib/ui"

export const metadata: Metadata = {
  title: "Sign in",
}

const ERRORS: Record<string, string> = {
  invalid: "That email and password do not match an account. Check them and try again.",
  rate_limited: "Too many sign-in attempts. Wait 15 minutes, then try again.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (session?.user) redirect("/")

  const { error } = await searchParams
  const errorMessage = error ? (ERRORS[error] ?? "We could not sign you in. Please try again.") : null

  return (
    <AuthShell
      footer={
        <>
          Trouble signing in? Email{" "}
          <a href="mailto:support@verifychain.africa" className="font-medium text-gray-700 underline underline-offset-2 dark:text-gray-300">
            support@verifychain.africa
          </a>
        </>
      }
    >
      <AuthCard>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Sign in to VerifyChain
        </h1>
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
          Manufacturers and VerifyChain staff sign in here. New companies can
          register with Google.
        </p>

        {errorMessage && (
          <div className="mt-5">
            <Notice tone="error">{errorMessage}</Notice>
          </div>
        )}

        <form
          className="mt-6"
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/" })
          }}
        >
          <SubmitButton className={`${buttonSecondary} w-full`} pendingLabel="Opening Google">
            <GoogleIcon />
            Continue with Google
          </SubmitButton>
        </form>

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
          <span className="text-xs text-gray-500 dark:text-gray-400">or use an email and password</span>
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        </div>

        <form action={handleCredentialsSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className={fieldLabel}>
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputBase}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className={fieldLabel}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputBase}
            />
          </div>
          <SubmitButton className={`${buttonPrimary} w-full`} pendingLabel="Signing in">
            Sign in
          </SubmitButton>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Email sign-in is for accounts set up by the VerifyChain team. If you
            were given a temporary password, you will choose a new one next.
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  )
}

async function handleCredentialsSignIn(formData: FormData) {
  "use server"
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  try {
    await signIn("credentials", { email, password, redirect: false })
  } catch (err) {
    if (err instanceof TooManyAttempts) redirect("/login?error=rate_limited")
    if (err instanceof AuthError) redirect("/login?error=invalid")
    throw err
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true, mustResetPassword: true },
  })
  redirect(user ? homePathFor(user) : "/")
}
