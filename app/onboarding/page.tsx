import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const existing = await prisma.manufacturer.findUnique({
    where: { userId: session.user.id },
  })

  if (existing) redirect("/dashboard")

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-200 w-full max-w-md">

        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-900 rounded-xl mb-4">
            <span className="text-white text-lg font-bold">V</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Set up your account
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Tell us about your company to get started.
          </p>
        </div>

        <form action={createManufacturer} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="companyName"
              className="text-sm font-medium text-gray-700"
            >
              Company Name
            </label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              required
              autoComplete="organization"
              placeholder="e.g. Lagos Beverages Ltd"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="contactEmail"
              className="text-sm font-medium text-gray-700"
            >
              Contact Email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              required
              autoComplete="email"
              placeholder="contact@yourcompany.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700 active:scale-95"
          >
            Create Account
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Signed in as{" "}
          <span className="font-medium text-gray-600">{session.user?.email}</span>
        </p>
      </div>
    </main>
  )
}

async function createManufacturer(formData: FormData) {
  "use server"

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const companyName = formData.get("companyName") as string
const contactEmail = formData.get("contactEmail") as string

if (!companyName) return

await prisma.manufacturer.create({
  data: {
    userId: session.user.id,
    companyName,
    primaryContact: contactEmail,
  },
})

  redirect("/dashboard")
}