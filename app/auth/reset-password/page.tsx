import type { Metadata } from "next"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { auth, unstable_update } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { homePathFor } from "@/lib/home-path"
import { handleSignOut } from "@/lib/actions/auth"
import { AuthCard, AuthShell, Notice } from "@/components/ui/auth-shell"
import { SubmitButton } from "@/components/ui/submit-button"
import { buttonPrimary, fieldHint, fieldLabel, inputBase } from "@/lib/ui"

export const metadata: Metadata = {
  title: "Choose a new password",
}

const ERRORS: Record<string, string> = {
  short: "Your password needs at least 8 characters.",
  mismatch: "The two passwords do not match.",
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Only accounts with a temporary password are sent here.
  if (!session.user.mustResetPassword) redirect("/")

  const { error } = await searchParams
  const errorMessage = error ? ERRORS[error] ?? "Please check your password and try again." : null

  return (
    <AuthShell
      footer={
        <form action={handleSignOut}>
          <button type="submit" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200">
            Sign out
          </button>
        </form>
      }
    >
      <AuthCard>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Choose a new password
        </h1>
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
          You signed in with a temporary password. Set your own to continue to
          your account.
        </p>

        {errorMessage && (
          <div className="mt-5">
            <Notice tone="error">{errorMessage}</Notice>
          </div>
        )}

        <form action={handlePasswordReset} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="password" className={fieldLabel}>
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby="password-hint"
              className={inputBase}
            />
            <p id="password-hint" className={fieldHint}>
              At least 8 characters.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className={fieldLabel}>
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={inputBase}
            />
          </div>
          <SubmitButton className={`${buttonPrimary} w-full`} pendingLabel="Saving">
            Save password and continue
          </SubmitButton>
        </form>
      </AuthCard>
    </AuthShell>
  )
}

async function handlePasswordReset(formData: FormData) {
  "use server"

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (password.length < 8) redirect("/auth/reset-password?error=short")
  if (password !== confirmPassword) redirect("/auth/reset-password?error=mismatch")

  const hashed = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      password: hashed,
      mustResetPassword: false,
      tempPasswordUsed: true,
    },
  })

  // Refresh the session token so it no longer carries mustResetPassword.
  await unstable_update({})

  redirect(homePathFor({ role: session.user.role }))
}
