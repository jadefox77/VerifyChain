import Link from "next/link"
import { ArrowRight, MapPin, ScanLine } from "lucide-react"
import { LogoMark } from "@/components/ui/logo"
import { ResultCard } from "@/components/verify/result-card"
import { buttonPrimary, buttonSecondary } from "@/lib/ui"
import { CTA_REGISTER } from "./chrome"

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-gray-200 dark:border-gray-800">
      {/* Soft brand wash behind the phone, kept to one accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-brand-100/60 blur-3xl dark:bg-brand-500/10"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-16 pt-14 sm:px-6 md:pb-24 md:pt-20 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="vc-rise">
          <p className="text-sm font-medium text-brand-700 dark:text-brand-400">
            Product authentication for manufacturers in Nigeria
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-gray-900 sm:text-5xl xl:text-[3.6rem] dark:text-white">
            Proof of authenticity on every bottle.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            Signed QR codes on every unit, a second code inside the cap, and alerts that show where fakes and refills
            appear.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className={`${buttonPrimary} px-5 py-3 active:scale-[0.98]`}>
              {CTA_REGISTER}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className={`${buttonSecondary} px-5 py-3 active:scale-[0.98]`}>
              See how a check works
            </a>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  )
}

// The real result card the scan pages use, inside a phone frame, with an
// example of the alert the manufacturer would see. Decorative, so hidden
// from screen readers; the copy around it says the same thing.
function HeroVisual() {
  return (
    <div className="vc-rise-late relative mx-auto w-full max-w-md pb-14" aria-hidden="true">
      <div className="mx-auto w-[19rem] rounded-[2.4rem] border border-gray-200 bg-gray-100 p-2.5 shadow-2xl shadow-brand-900/10 sm:w-[21rem] dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/40">
        <div className="overflow-hidden rounded-[1.9rem] bg-gray-50 dark:bg-gray-950">
          <div className="flex items-center justify-center gap-2 border-b border-gray-200/70 bg-white py-4 dark:border-gray-800 dark:bg-gray-950">
            <LogoMark className="h-5 w-5" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">VerifyChain</span>
          </div>
          <div className="p-4 [&_h1]:text-lg">
            <ResultCard
              tone="good"
              title="Genuine product"
              message="This Premium Malt 33cl is genuine. This is the first time the cap has been opened."
              details={[
                { label: "Bottle and cap", value: "Matched" },
                { label: "Checked", value: "Today, 14:32" },
              ]}
            />
            <p className="pt-3 text-right text-[11px] text-gray-400">Example result screen</p>
          </div>
        </div>
      </div>

      <div className="absolute -left-2 bottom-0 w-64 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl shadow-gray-900/10 backdrop-blur sm:-left-10 dark:border-gray-800 dark:bg-gray-900/95 dark:shadow-black/40">
        <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
          <MapPin className="h-3.5 w-3.5" />
          Impossible travel
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          One bottle scanned in Lagos and in Kano, 40 minutes apart.
        </p>
        <p className="mt-2 text-[11px] text-gray-400">Example alert in your dashboard</p>
      </div>
    </div>
  )
}

// Directly under the hero: one line for shoppers, and quick routes for the
// other people who land here.
export function AudienceStrip() {
  const routes = [
    { href: "#manufacturers", label: "Manufacturers" },
    { href: "#people", label: "Regulators" },
    { href: "#api", label: "Developers" },
  ]
  return (
    <section aria-label="Who this page is for" className="bg-gray-50 dark:bg-gray-900/50">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
          <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <span>
            <span className="font-semibold text-gray-900 dark:text-white">Checking something you bought?</span> Point
            your phone camera at the QR code on the label and tap the link. No app or account needed.
          </span>
        </p>
        <nav aria-label="Jump to" className="flex flex-wrap gap-2 text-sm">
          {routes.map((r) => (
            <a
              key={r.href}
              href={r.href}
              className="rounded-full border border-gray-300 bg-white px-3.5 py-1.5 font-medium text-gray-700 transition-colors hover:border-brand-500 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:text-brand-300"
            >
              {r.label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  )
}
