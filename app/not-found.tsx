import Link from "next/link"
import { AuthCard, AuthShell } from "@/components/ui/auth-shell"
import { buttonPrimary } from "@/lib/ui"

export default function NotFound() {
  return (
    <AuthShell>
      <AuthCard>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Error 404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          We could not find that page
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          The link may be out of date, or the page may have moved. If you were
          checking a product, scan the QR code on the pack again.
        </p>
        <Link href="/" className={`${buttonPrimary} mt-6 w-full`}>
          Go to the home page
        </Link>
      </AuthCard>
    </AuthShell>
  )
}
