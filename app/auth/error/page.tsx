import type { Metadata } from "next"
import Link from "next/link"
import { AuthCard, AuthShell } from "@/components/ui/auth-shell"
import { buttonPrimary } from "@/lib/ui"

export const metadata: Metadata = {
  title: "Sign-in problem",
}

const MESSAGES: Record<string, { title: string; body: string }> = {
  AccessDenied: {
    title: "Access was not granted",
    body: "This account is not allowed to sign in. If you think that is a mistake, contact support.",
  },
  Configuration: {
    title: "Sign-in is unavailable",
    body: "We could not complete sign-in because of a problem on our side. Please try again in a few minutes.",
  },
  Verification: {
    title: "This sign-in link has expired",
    body: "Sign-in links can only be used once and expire after a short time. Start again from the sign-in page.",
  },
  OAuthAccountNotLinked: {
    title: "This email already has an account",
    body: "Sign in with the method you used before, such as email and password, then contact support if you want to add Google sign-in.",
  },
}

const FALLBACK = {
  title: "We could not sign you in",
  body: "Something went wrong during sign-in. Please try again.",
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const message = (error && MESSAGES[error]) || FALLBACK

  return (
    <AuthShell
      footer={
        <>
          Need help? Email{" "}
          <a href="mailto:support@verifychain.africa" className="font-medium text-gray-700 underline underline-offset-2 dark:text-gray-300">
            support@verifychain.africa
          </a>
        </>
      }
    >
      <AuthCard>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">{message.title}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message.body}</p>
        <Link href="/login" className={`${buttonPrimary} mt-6 w-full`}>
          Back to sign in
        </Link>
      </AuthCard>
    </AuthShell>
  )
}
