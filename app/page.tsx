import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  BellRing,
  Boxes,
  CheckCircle2,
  Factory,
  FileSpreadsheet,
  Fingerprint,
  Landmark,
  Lock,
  MapPinOff,
  QrCode,
  ScanLine,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { Logo, LogoMark } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { buttonPrimary, buttonSecondary } from "@/lib/ui"

const SUPPORT_EMAIL = "support@verifychain.africa"

export default async function HomePage() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <SiteHeader />
      <main id="main">
        <Hero />
        <ShopperStrip />
        <RefillProblem />
        <HowItWorks />
        <ForManufacturers />
        <Safeguards />
        <Onboarding />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 backdrop-blur dark:border-gray-800/80 dark:bg-gray-950/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="VerifyChain Africa home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-gray-600 md:flex dark:text-gray-400">
          <a href="#how-it-works" className="hover:text-gray-900 dark:hover:text-white">How it works</a>
          <a href="#manufacturers" className="hover:text-gray-900 dark:hover:text-white">For manufacturers</a>
          <a href="#safeguards" className="hover:text-gray-900 dark:hover:text-white">Safeguards</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle className="max-sm:hidden" />
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Sign in
          </Link>
          <Link href="/login" className={`${buttonPrimary} px-3.5 py-2 max-sm:hidden`}>
            Register your company
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm font-medium text-brand-700 dark:text-brand-400">
            Product authentication for manufacturers in Nigeria
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Give every bottle an identity your customers can check.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            VerifyChain Africa prints a unique, signed QR code on each unit and a
            second one inside the cap. A shopper scans with their phone camera and
            sees within seconds whether the product is genuine, already opened, or
            possibly refilled.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className={`${buttonPrimary} px-5 py-3`}>
              Register your company
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className={`${buttonSecondary} px-5 py-3`}>
              See how a check works
            </a>
          </div>
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            Shoppers do not need an app or an account. The check runs in any phone browser.
          </p>
        </div>

        <ResultPreview />
      </div>
    </section>
  )
}

// A static rendering of the real consumer result screen, so visitors see
// exactly what a shopper sees after scanning.
function ResultPreview() {
  return (
    <div className="mx-auto w-full max-w-sm" aria-hidden="true">
      <div className="rounded-[2rem] border border-gray-200 bg-gray-50 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="rounded-[1.5rem] bg-white p-5 dark:bg-gray-950">
          <div className="flex items-center justify-center gap-2 pb-5">
            <LogoMark className="h-6 w-6" />
            <span className="text-sm font-semibold">VerifyChain</span>
          </div>
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-center dark:border-brand-500/25 dark:bg-brand-500/10">
            <CheckCircle2 className="mx-auto h-10 w-10 text-brand-600 dark:text-brand-400" />
            <p className="mt-3 text-lg font-semibold text-brand-900 dark:text-brand-200">Genuine product</p>
            <p className="mt-1 text-sm text-brand-800/80 dark:text-brand-200/80">
              First opening confirmed. The cap matches this bottle.
            </p>
            <dl className="mt-4 space-y-2 rounded-xl bg-white/70 p-3 text-left text-xs dark:bg-gray-950/50">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Product</dt>
                <dd className="font-medium">Premium Malt 33cl</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Bottle and cap</dt>
                <dd className="font-medium">Matched</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Checked</dt>
                <dd className="font-medium">Today, 14:32</dd>
              </div>
            </dl>
          </div>
          <p className="pt-4 text-center text-xs text-gray-400">Example result screen</p>
        </div>
      </div>
    </div>
  )
}

function ShopperStrip() {
  return (
    <section className="bg-gray-50 dark:bg-gray-900/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <ScanLine className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold text-gray-900 dark:text-white">Checking a product you bought?</span>{" "}
            Point your phone camera at the QR code on the label and tap the link that appears.
          </p>
        </div>
      </div>
    </section>
  )
}

function RefillProblem() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            A refilled bottle looks exactly like the real one.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-400">
            Empty bottles from known brands are collected, refilled and resealed.
            The label is original, so checking the outside of the pack proves very
            little. The proof has to come from something a counterfeiter cannot
            reuse without opening the product.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Fingerprint,
              title: "One identity per unit",
              body: "Every bottle, can or sachet gets its own code. Codes are signed, so made-up or edited codes are rejected.",
            },
            {
              icon: Lock,
              title: "A code hidden in the cap",
              body: "The second code is printed inside the cap and can only be scanned once the product is opened.",
            },
            {
              icon: TriangleAlert,
              title: "Reuse shows up",
              body: "A cap that has already been opened, or a cap from a different bottle, is reported to the shopper and flagged.",
            },
            {
              icon: BellRing,
              title: "You hear about it",
              body: "Flagged scans and suspicious patterns appear in your dashboard as alerts with time and location, when shared.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
              <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Scan the label",
      body: "The shopper scans the QR code on the bottle and taps Verify. The bottle is confirmed and remembered on that phone for 10 minutes.",
    },
    {
      n: "2",
      title: "Open and scan the cap",
      body: "After opening, they scan the code printed inside the cap and tap Confirm. The cap is checked against the bottle from step 1.",
    },
    {
      n: "3",
      title: "Read a clear result",
      body: "They see one of three answers, written in plain language, with no account or download needed.",
    },
  ]

  const results = [
    {
      icon: CheckCircle2,
      tone: "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300",
      title: "Genuine",
      body: "The cap belongs to this bottle and was still sealed.",
    },
    {
      icon: TriangleAlert,
      tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
      title: "Already opened",
      body: "This cap was scanned before. The product may have been refilled.",
    },
    {
      icon: XCircle,
      tone: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300",
      title: "Mismatch",
      body: "The cap is from a different bottle. Both are flagged.",
    },
  ]

  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            How a check works
          </h2>
          <p className="mt-3 text-base text-gray-600 dark:text-gray-400">
            Bottles, jars and spirits use two codes. Cans, sachets and cartons use a
            single code that can be confirmed as genuine once.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="relative rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white dark:bg-white dark:text-gray-900">
                {s.n}
              </span>
              <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {results.map(({ icon: Icon, tone, title, body }) => (
            <div key={title} className={`flex gap-3 rounded-xl border p-4 ${tone}`}>
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-sm opacity-90">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ForManufacturers() {
  const features = [
    {
      icon: Boxes,
      title: "Batches and print files",
      body: "Generate up to 5,000 serialised units per batch and download print-ready QR images as a ZIP, with a CSV of every serial.",
    },
    {
      icon: ScanLine,
      title: "Scan logs",
      body: "See every verification by product, layer, time and result, and filter to the scans that were flagged.",
    },
    {
      icon: ShieldAlert,
      title: "Fraud alerts",
      body: "A daily check looks for repeat scans, the same unit scanned in two distant places, units scanned outside their target state, and automated scanning.",
    },
    {
      icon: Factory,
      title: "Production line pairing",
      body: "Print bottle and cap codes separately and pair them on the line through a signed scanner API, or record pairings by hand.",
    },
    {
      icon: Landmark,
      title: "Regulator access",
      body: "Regulatory observers get a read-only, scoped view of incidents and can export a report for the last 90 days.",
    },
    {
      icon: FileSpreadsheet,
      title: "Exports",
      body: "Download batch serials, alert history and incident reports as CSV for your own records and audits.",
    },
  ]

  return (
    <section id="manufacturers" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
          What manufacturers get
        </h2>
        <p className="mt-3 text-base text-gray-600 dark:text-gray-400">
          One dashboard to create codes, follow every scan and act on the ones
          that look wrong.
        </p>
      </div>
      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-gray-800 dark:bg-gray-800">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-white p-6 dark:bg-gray-950">
            <Icon className="h-5 w-5 text-gray-900 dark:text-white" aria-hidden="true" />
            <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Safeguards() {
  const items = [
    {
      icon: QrCode,
      title: "Signed codes",
      body: "Each QR link carries a cryptographic signature. Codes that are edited or invented are rejected before any lookup.",
    },
    {
      icon: ScanLine,
      title: "Nothing counts until a person taps",
      body: "Opening the link does not use up a code. Link previews, crawlers and browser prefetching cannot mark a product as opened.",
    },
    {
      icon: Lock,
      title: "One first opening",
      body: "The first-open check is atomic, so two people scanning the same cap at the same moment cannot both be told it is genuine.",
    },
    {
      icon: MapPinOff,
      title: "Location is optional",
      body: "The phone asks before sharing location and the check still works if the shopper says no. IP addresses are hashed, never stored as is.",
    },
  ]

  return (
    <section id="safeguards" className="scroll-mt-20 bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">Safeguards built into every check</h2>
          <p className="mt-3 text-base text-gray-400">
            A result is only useful if it cannot be gamed. These protections apply
            to every scan.
          </p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-5 w-5 text-brand-300" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Onboarding() {
  const stages = [
    { title: "Apply", body: "Sign in and tell us about your company, products and production lines." },
    { title: "Compliance review", body: "We check your CAC registration and NAFDAC numbers." },
    { title: "Integration", body: "We set up your account and, if needed, factory scanner access." },
    { title: "Pilot batch", body: "You run a test batch to confirm printing and scanning work on your line." },
    { title: "Production", body: "Your dashboard opens and you can serialise every run." },
  ]

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            From application to your first production run
          </h2>
          <p className="mt-3 text-base text-gray-600 dark:text-gray-400">
            Every manufacturer is reviewed before codes can be issued, so only
            registered companies can put the VerifyChain check on a product.
          </p>
        </div>
        <ol className="space-y-0">
          {stages.map((s, i) => (
            <li key={s.title} className="relative flex gap-4 pb-8 last:pb-0">
              {i < stages.length - 1 && (
                <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-gray-200 dark:bg-gray-800" aria-hidden="true" />
              )}
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
                {i + 1}
              </span>
              <div className="pt-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function ClosingCta() {
  return (
    <section className="border-t border-gray-200 bg-brand-50 dark:border-gray-800 dark:bg-brand-950/40">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Start with a pilot batch on one product line.
          </h2>
          <p className="mt-2 text-base text-gray-700 dark:text-gray-300">
            Register your company to begin the review. Questions first? Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-800 underline underline-offset-2 dark:text-brand-300">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
        <Link href="/login" className={`${buttonPrimary} px-5 py-3`}>
          Register your company
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Product authentication for bottled and packaged goods.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-600 dark:text-gray-400">
          <Link href="/login" className="hover:text-gray-900 dark:hover:text-white">Sign in</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-gray-900 dark:hover:text-white">{SUPPORT_EMAIL}</a>
          <ThemeToggle className="sm:hidden" />
          <span className="text-gray-400 dark:text-gray-500">&copy; {new Date().getFullYear()} VerifyChain Africa</span>
        </div>
      </div>
    </footer>
  )
}
