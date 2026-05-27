import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Shield } from "lucide-react"
import bcrypt from "bcryptjs"

export default async function ResetPasswordPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Only show this page if password reset is required
  if (!session.user.mustResetPassword) redirect("/")

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-white">
            Set Your Password
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            You must set a new password before continuing.
          </p>
        </div>

        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5">
          <form action={handlePasswordReset} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                New Password
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                Confirm Password
              </label>
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                placeholder="Repeat your password"
                className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Set Password & Continue
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

async function handlePasswordReset(formData: FormData) {
  "use server"

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!password || password !== confirmPassword || password.length < 8) {
    redirect("/auth/reset-password?error=invalid")
  }

  const hashed = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      password: hashed,
      mustResetPassword: false,
      tempPasswordUsed: true,
    },
  })

  redirect("/")
}