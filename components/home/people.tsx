import Link from "next/link"
import { ArrowRight, ChevronDown } from "lucide-react"
import { MANUFACTURER_ROLE_LIST, TEAM_ROLE_DESCRIPTIONS, TEAM_ROLE_LABELS } from "@/lib/permissions"
import { CTA_REGISTER, SUPPORT_EMAIL, SectionHeading } from "./chrome"

export function People() {
  const platform = [
    {
      title: "Regulatory observers",
      body: "A read-only view of fraud events by state and by batch, and a 90-day incident report to download.",
    },
    {
      title: "Fraud analysts",
      body: "VerifyChain staff who review alerts across every manufacturer and mark them resolved.",
    },
    {
      title: "VerifyChain support",
      body: "Review applications, move companies through onboarding and help with serialisation and factory pairing.",
    },
  ]

  return (
    <section id="people" aria-labelledby="people-heading" className="scroll-mt-20 bg-gray-50 dark:bg-gray-900/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
        <SectionHeading id="people-heading" title="Built for everyone who handles the product">
          Your own staff sign in to your company&apos;s workspace. Regulators and VerifyChain&apos;s own team use a
          separate portal with its own permissions.
        </SectionHeading>

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          <RoleGroup
            title="Your company"
            rows={MANUFACTURER_ROLE_LIST.map((r) => ({ title: TEAM_ROLE_LABELS[r], body: TEAM_ROLE_DESCRIPTIONS[r] }))}
          />
          <RoleGroup title="Regulators and VerifyChain" rows={platform} />
        </div>
      </div>
    </section>
  )
}

function RoleGroup({ title, rows }: { title: string; rows: { title: string; body: string }[] }) {
  return (
    <div className="vc-reveal rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 dark:border-gray-800 dark:bg-gray-950">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      <dl className="mt-6 space-y-5">
        {rows.map((r) => (
          <div key={r.title} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-6">
            <dt className="text-sm font-semibold text-gray-900 dark:text-white">{r.title}</dt>
            <dd className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{r.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function Onboarding() {
  const stages = [
    { title: "Apply", body: "Sign in and tell us about your company, products and production lines." },
    { title: "Compliance review", body: "We check your CAC registration and NAFDAC numbers." },
    { title: "Integration", body: "We set up your account and, if needed, factory scanner access." },
    { title: "Pilot batch", body: "A test batch confirms printing and scanning work on your line." },
    { title: "Production", body: "Your dashboard opens and you can serialise every run." },
  ]

  return (
    <section aria-labelledby="onboarding-heading">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
        <SectionHeading
          id="onboarding-heading"
          eyebrow="Getting started"
          title="From application to your first production run"
        >
          Every manufacturer is reviewed before codes can be issued, so only registered companies can put the
          VerifyChain check on a product.
        </SectionHeading>
        <ol className="mt-12 grid gap-8 md:grid-cols-5 md:gap-4">
          {stages.map((s, i) => (
            <li key={s.title} className="vc-reveal relative flex gap-4 md:block">
              <div className="flex items-center gap-3 md:mb-5">
                <span className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-300 bg-white text-sm font-semibold text-brand-800 dark:border-brand-500/40 dark:bg-gray-950 dark:text-brand-300">
                  {i + 1}
                </span>
                {i < stages.length - 1 && (
                  <span aria-hidden="true" className="hidden h-px flex-1 bg-brand-200 md:block dark:bg-brand-500/25" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Faq() {
  const items = [
    {
      q: "Do shoppers need to download an app?",
      a: "No. They point their normal phone camera at the QR code and the check opens in the browser. No account is needed.",
    },
    {
      q: "Should my product use one code or two?",
      a: "Use two codes, one on the label and one inside the cap, whenever the product has a cap. A single code suits cans, sachets, cartons and pouches, but it cannot tell a copy from the original if the copy is checked first.",
    },
    {
      q: "What happens when a product fails a check?",
      a: "The shopper is told plainly not to use it and what to do next. The scan is flagged in your dashboard, and patterns across many scans become alerts after the nightly fraud checks.",
    },
    {
      q: "Do you collect shoppers' locations?",
      a: "Only if the shopper agrees when their phone asks. The check works the same without it. IP addresses are never stored as they are, only as a keyed hash.",
    },
    {
      q: "Can we show results on our own website?",
      a: "Yes. Create a key in the dashboard and call the verification API. The docs at /developers show every request and response.",
    },
    {
      q: "Can regulators see our data?",
      a: "Regulatory observers have a read-only view of incidents and can download a 90-day report. They cannot change anything.",
    },
  ]

  return (
    <section aria-labelledby="faq-heading" className="border-t border-gray-200 dark:border-gray-800">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:py-24 lg:grid-cols-[0.7fr_1.3fr]">
        <SectionHeading id="faq-heading" title="Questions we get asked">
          Something else? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300">
            {SUPPORT_EMAIL}
          </a>
          .
        </SectionHeading>
        <div className="space-y-3">
          {items.map((it) => (
            <details
              key={it.q}
              className="group rounded-2xl border border-gray-200 bg-white px-5 open:pb-5 dark:border-gray-800 dark:bg-gray-950"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-gray-900 dark:text-white [&::-webkit-details-marker]:hidden">
                {it.q}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-[65ch] text-sm leading-relaxed text-gray-600 dark:text-gray-400">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ClosingCta() {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand-700 px-6 py-14 text-white sm:px-12 dark:bg-brand-900">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-400/30 blur-3xl"
        />
        <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight">Start with a pilot batch on one product line.</h2>
            <p className="mt-3 text-base leading-relaxed text-brand-50/90">
              Register your company to begin the review. You can test printing and scanning on your own line before
              anything reaches a shop.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-50 active:scale-[0.98]"
          >
            {CTA_REGISTER}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
