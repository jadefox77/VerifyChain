import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { SiteFooter, SiteHeader } from "@/components/home/chrome"
import { AudienceStrip, Hero } from "@/components/home/hero"
import { HowItWorks, RefillProblem, Safeguards } from "@/components/home/how-it-works"
import { FraudChecks, Platform } from "@/components/home/platform"
import { BrandPages, DeveloperApi } from "@/components/home/brand-and-api"
import { ClosingCta, Faq, Onboarding, People } from "@/components/home/people"

// The public homepage. Each section lives in components/home and states only
// what the product does today; numbers come from the same constants the code
// uses (lib/recent-bottles, lib/regions, lib/nigeria, lib/permissions).
export default async function HomePage() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <SiteHeader />
      <main id="main">
        <Hero />
        <AudienceStrip />
        <RefillProblem />
        <HowItWorks />
        <Safeguards />
        <Platform />
        <FraudChecks />
        <BrandPages />
        <DeveloperApi />
        <People />
        <Onboarding />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  )
}
