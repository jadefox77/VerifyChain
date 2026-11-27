import type { Metadata } from "next"
import Link from "next/link"
import { ShieldX } from "lucide-react"
import { auth } from "@/lib/auth"
import { handleSignOut } from "@/lib/actions/auth"
import { AuthCard, AuthShell } from "@/components/ui/auth-shell"
import { buttonPrimary, buttonSecondary } from "@/lib/ui"

export const metadata: Metadata = {
  title: "No access",
}

export default async function UnauthorizedPage() {
  const session = await auth()

  return (
    <AuthShell>
      <AuthCard>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <ShieldX className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          You do not have access to this page
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Your account role does not include this area. If you need access, ask
          a VerifyChain administrator to update your role.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href="/" className={`${buttonPrimary} flex-1`}>
            Go to my home page
          </Link>
          {session?.user ? (
            <form action={handleSignOut} className="flex-1">
              <button type="submit" className={`${buttonSecondary} w-full`}>
                Use another account
              </button>
            </form>
          ) : (
            <Link href="/login" className={`${buttonSecondary} flex-1`}>
              Sign in
            </Link>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  )
}
