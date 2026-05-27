import { requireSuperAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import bcrypt from "bcryptjs"
import crypto from "crypto"

export default async function CreateManufacturerPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; password?: string; email?: string }>
}) {
  await requireSuperAdmin()
  const params = await searchParams

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/admin/manufacturers"
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 font-mono mb-6 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Manufacturers
      </Link>

      <h1 className="text-lg font-bold text-white mb-1">
        Create Manufacturer Account
      </h1>
      <p className="text-xs text-gray-500 font-mono mb-6">
        For manufacturers onboarded via field sales or office visits.
        Credentials will be displayed once for you to share with them.
      </p>

      {/* Success state — show credentials */}
      {params.created === "true" && params.password && params.email && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-green-400">
            ✓ Account Created Successfully
          </h2>
          <p className="text-xs text-green-400/70">
            Share these credentials with the manufacturer. This is the
            only time the temporary password will be shown.
          </p>
          <div className="space-y-2 p-3 bg-gray-900/60 rounded-lg border border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-gray-500">
                Email
              </span>
              <span className="text-sm font-mono text-white">
                {params.email}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-gray-500">
                Temporary Password
              </span>
              <span className="text-sm font-mono text-yellow-400 font-bold">
                {params.password}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-gray-500">
                Login URL
              </span>
              <span className="text-sm font-mono text-blue-400">
                {process.env.NEXT_PUBLIC_APP_URL}/login
              </span>
            </div>
          </div>
          <p className="text-[10px] text-gray-600 font-mono">
            The manufacturer will be required to set a new password on
            first login. This page will not show these credentials again.
          </p>
          <Link
            href="/admin/manufacturers"
            className="inline-block px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs font-mono hover:bg-gray-700 transition-colors"
          >
            View all manufacturers
          </Link>
        </div>
      )}

      {/* Creation form */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5">
        <form action={createManufacturerAccount} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                Company Name *
              </label>
              <input
                name="companyName"
                required
                placeholder="e.g. Kano Beverages Ltd"
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                RC Number
              </label>
              <input
                name="rcNumber"
                placeholder="e.g. RC-1234567"
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                Contact Name *
              </label>
              <input
                name="contactName"
                required
                placeholder="Primary contact full name"
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                Phone
              </label>
              <input
                name="phone"
                type="tel"
                placeholder="+234 800 000 0000"
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              Login Email Address *
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="manufacturer@company.com"
              className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
            />
            <p className="text-[10px] text-gray-600">
              This will be the manufacturer's login email. Must be unique.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                Industry
              </label>
              <select
                name="industryType"
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-gray-600"
              >
                <option value="">Select industry</option>
                <option value="Beverage — Beer">Beer</option>
                <option value="Beverage — Soft Drink">Soft Drink</option>
                <option value="Beverage — Water">Water</option>
                <option value="Beverage — Energy Drink">Energy Drink</option>
                <option value="Spirits & Alcoholic Beverages">Spirits</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                Subscription Plan
              </label>
              <select
                name="subscriptionPlan"
                className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-gray-600"
              >
                <option value="FREE">Free</option>
                <option value="STARTER">Starter</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              NAFDAC Numbers
            </label>
            <input
              name="nafdacNumbers"
              placeholder="e.g. NAFDAC/FD/2024/001"
              className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              Initial Onboarding Status
            </label>
            <select
              name="onboardingStatus"
              className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-gray-600"
            >
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="COMPLIANCE_VERIFICATION">Compliance Verification</option>
              <option value="TECHNICAL_INTEGRATION">Technical Integration</option>
              <option value="PILOT_APPROVAL">Pilot Approval</option>
              <option value="ACTIVE_PRODUCTION">Active Production</option>
            </select>
            <p className="text-[10px] text-gray-600">
              Set to Active Production if the manufacturer is already
              fully verified offline.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-800/60">
            <div className="flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg mb-4">
              <p className="text-xs text-yellow-400">
                A temporary password will be auto-generated and displayed
                after submission. The manufacturer must change it on first
                login.
              </p>
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-mono hover:bg-blue-500 transition-colors"
            >
              Create Account & Generate Credentials
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

async function createManufacturerAccount(formData: FormData) {
  "use server"

  const companyName = formData.get("companyName") as string
  const rcNumber = formData.get("rcNumber") as string
  const contactName = formData.get("contactName") as string
  const phone = formData.get("phone") as string
  const email = formData.get("email") as string
  const industryType = formData.get("industryType") as string
  const nafdacNumbers = formData.get("nafdacNumbers") as string
  const subscriptionPlan = formData.get("subscriptionPlan") as string
  const onboardingStatus = formData.get("onboardingStatus") as string

  if (!companyName || !email || !contactName) return

  // Check email not already in use
  const existing = await prisma.user.findUnique({
    where: { email },
  })
  if (existing) {
    redirect("/admin/manufacturers/create?error=email_exists")
  }

  // Generate temporary password
  const tempPassword = crypto.randomBytes(4).toString("hex").toUpperCase()
  // Format: XXXX-XXXX for readability
  const formattedTemp = `${tempPassword.slice(0, 4)}-${tempPassword.slice(4)}`
  const hashed = await bcrypt.hash(formattedTemp, 12)

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      name: contactName,
      role: "MANUFACTURER_ADMIN",
      password: hashed,
      mustResetPassword: true,
    },
  })

  // Create manufacturer record
  await prisma.manufacturer.create({
    data: {
      userId: user.id,
      companyName,
      rcNumber: rcNumber || null,
      primaryContact: contactName,
      phone: phone || null,
      industryType: industryType || null,
      nafdacNumbers: nafdacNumbers || null,
      onboardingStatus: onboardingStatus as any,
      subscriptionPlan: subscriptionPlan as any,
    },
  })

  // Redirect showing credentials in URL params
  // In production replace with proper session flash or server-side storage
  redirect(
    `/admin/manufacturers/create?created=true&email=${encodeURIComponent(email)}&password=${encodeURIComponent(formattedTemp)}`
  )
}