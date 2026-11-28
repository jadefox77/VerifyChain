import {
  CheckCircle2,
  Fingerprint,
  Hand,
  Layers,
  Lock,
  MapPinOff,
  Package,
  Smartphone,
  TriangleAlert,
  XCircle,
} from "lucide-react"
import { BOTTLE_TTL_MS, MAX_RECENT_BOTTLES } from "@/lib/recent-bottles"
import { SectionHeading } from "./chrome"

const BOTTLE_MINUTES = BOTTLE_TTL_MS / 60_000

export function RefillProblem() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
      <div className="vc-reveal max-w-4xl">
        <h2 className="text-3xl font-semibold leading-[1.15] tracking-tight text-gray-900 sm:text-5xl dark:text-white">
          A refilled bottle carries a real label.
        </h2>
        <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          Empty bottles from known brands are collected, refilled and resealed. Checking the outside of the pack proves
          very little, so VerifyChain puts the proof somewhere a counterfeiter cannot reuse without opening the product:
          a code printed inside the cap, tied to one bottle.
        </p>
      </div>
    </section>
  )
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="scroll-mt-20 border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
        <SectionHeading id="how-heading" eyebrow="How a check works" title="Two ways to protect a product">
          You choose the mode for each product when you add it. Shoppers use their normal phone camera and browser for
          both.
        </SectionHeading>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <ModeTwoCodes />
          <ModeOneCode />
        </div>

        <CrateBand />
        <Results />
      </div>
    </section>
  )
}

function ModeTwoCodes() {
  const steps = [
    {
      title: "Scan the label",
      body: `The shopper scans the QR code on the bottle and taps Verify. The phone remembers that bottle for ${BOTTLE_MINUTES} minutes.`,
    },
    {
      title: "Open it and scan the cap",
      body: "After opening, they scan the code printed inside the cap and tap Confirm. The cap is checked against that bottle.",
    },
    {
      title: "Read the answer",
      body: "Genuine and opened for the first time, opened before, or a cap from a different bottle.",
    },
  ]
  return (
    <article className="vc-reveal rounded-2xl border border-brand-200 bg-white p-6 shadow-sm shadow-brand-900/5 sm:p-8 dark:border-brand-500/25 dark:bg-gray-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white dark:bg-brand-500 dark:text-gray-950">
            <Layers className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Label and cap</h3>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-300">
          Recommended for anything with a cap
        </span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        For bottles, jars and spirits. One code on the label, a second hidden inside the cap. Catches copied labels,
        refills and swapped caps.
      </p>
      <ol className="mt-6 space-y-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white dark:bg-white dark:text-gray-900">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  )
}

function ModeOneCode() {
  return (
    <article className="vc-reveal flex flex-col rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
          <Package className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Single code</h3>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        For cans, sachets, cartons and pouches, where there is no cap to hide a second code in. The code can be confirmed
        once.
      </p>
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-semibold">What a single code cannot do</p>
        <p className="mt-1.5 text-amber-900/85 dark:text-amber-100/85">
          A printed code can be copied. Whoever checks a copy first is told it is genuine, because the system cannot tell
          that copy from the original. Every later check of that code is caught, and a code checked from several phones
          raises a copied-codes alert.
        </p>
      </div>
      <p className="mt-auto pt-6 text-sm font-medium text-gray-900 dark:text-white">
        If your product has a cap, use label and cap.
      </p>
    </article>
  )
}

function CrateBand() {
  return (
    <div className="vc-reveal mt-5 grid items-center gap-6 rounded-2xl bg-gray-900 p-6 text-white sm:p-8 md:grid-cols-[auto_1fr] dark:bg-gray-800/60">
      <div className="flex -space-x-2" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="flex h-12 w-9 items-end justify-center rounded-t-xl rounded-b-md border border-white/15 bg-brand-500/20 pb-1.5"
          >
            <span className="h-1.5 w-4 rounded-full bg-brand-300/80" />
          </span>
        ))}
      </div>
      <div>
        <h3 className="text-lg font-semibold">Checking a whole crate</h3>
        <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-gray-300">
          A retailer or shopper can scan the labels of up to {MAX_RECENT_BOTTLES} bottles first, then open them and scan
          the caps in any order. Each cap is matched to its own bottle, as long as that bottle was scanned in the last{" "}
          {BOTTLE_MINUTES} minutes.
        </p>
      </div>
    </div>
  )
}

function Results() {
  const results = [
    {
      icon: CheckCircle2,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100",
      title: "Genuine",
      body: "The code is real and this is its first check. For two codes, the cap belongs to this bottle and was sealed.",
    },
    {
      icon: TriangleAlert,
      tone: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100",
      title: "Checked before",
      body: "This code or cap was scanned earlier, with the time shown. A product you just opened may have been refilled.",
    },
    {
      icon: XCircle,
      tone: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100",
      title: "Do not use",
      body: "The cap is from another bottle, the code was altered, or it was flagged. The scan is reported to the brand.",
    },
  ]
  return (
    <div className="mt-10">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">What the shopper sees</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {results.map(({ icon: Icon, tone, title, body }) => (
          <div key={title} className={`flex gap-3 rounded-xl border p-4 ${tone}`}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-sm opacity-85">{body}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        These colours are fixed on every page, including branded ones, so a pass always looks like a pass.
      </p>
    </div>
  )
}

export function Safeguards() {
  const items = [
    {
      icon: Fingerprint,
      title: "Signed codes",
      body: "Each QR link carries a cryptographic signature. Edited or invented codes are rejected before any lookup.",
    },
    {
      icon: Hand,
      title: "Nothing counts until a person taps",
      body: "Opening the link does not use up a code, so link previews, crawlers and browser prefetching cannot mark a product as opened.",
    },
    {
      icon: Lock,
      title: "Only one first opening",
      body: "The first-open check is atomic. Two people scanning the same cap at the same moment cannot both be told it is genuine.",
    },
    {
      icon: Smartphone,
      title: "Limits per phone",
      body: "Each phone can make 10 checks a minute. Limits follow the device, so shoppers sharing one mobile network do not block each other.",
    },
    {
      icon: MapPinOff,
      title: "Location is optional",
      body: "The phone asks before sharing location and the check works if the shopper says no. IP addresses are stored only as a keyed hash.",
    },
  ]

  return (
    <section id="safeguards" aria-labelledby="safeguards-heading" className="scroll-mt-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 md:py-24 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading id="safeguards-heading" title="A result is only useful if it cannot be gamed">
            These protections apply to every scan, whichever mode a product uses and whether the check comes from our
            pages or your own app.
          </SectionHeading>
        </div>
        <ul className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="vc-reveal">
              <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
