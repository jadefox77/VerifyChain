import {
  Activity,
  BellRing,
  Boxes,
  Bot,
  Copy,
  Factory,
  FileArchive,
  Gauge,
  MapPinned,
  QrCode,
  Repeat,
  Route,
  ShieldAlert,
  Users,
} from "lucide-react"
import { NIGERIAN_STATES } from "@/lib/nigeria"
import { DRIFT_RADIUS_KM } from "@/lib/regions"
import { MANUFACTURER_ROLE_LIST, TEAM_ROLE_LABELS } from "@/lib/permissions"
import { SectionHeading } from "./chrome"

const MAX_BATCH_UNITS = 5000

export function Platform() {
  return (
    <section id="manufacturers" aria-labelledby="platform-heading" className="scroll-mt-20 bg-gray-50 dark:bg-gray-900/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
        <SectionHeading id="platform-heading" title="One dashboard, from the production line to the shelf">
          Create codes, print them, pair them on the line, follow every scan and act on the ones that look wrong.
        </SectionHeading>

        <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto]">
          {/* 1. Batches: the large tile */}
          <article className="vc-reveal relative overflow-hidden rounded-2xl bg-brand-700 p-7 text-white sm:p-9 lg:col-span-2 lg:row-span-2 dark:bg-brand-900">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-6 -right-6 grid grid-cols-6 gap-3 opacity-20 sm:grid-cols-8"
            >
              {Array.from({ length: 32 }, (_, i) => (
                <QrCode key={i} className="h-9 w-9" strokeWidth={1.5} />
              ))}
            </div>
            <div className="relative max-w-md">
              <Boxes className="h-6 w-6 text-brand-200" aria-hidden="true" />
              <h3 className="mt-5 text-2xl font-semibold tracking-tight">Batches and serialisation</h3>
              <p className="mt-3 text-base leading-relaxed text-brand-50/90">
                Generate up to {MAX_BATCH_UNITS.toLocaleString("en-NG")} serialised units per batch, each with its own
                signed code. Give a batch a target state so the fraud checks know where it should be sold.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-brand-50/90">
                <li className="flex items-center gap-2.5">
                  <FileArchive className="h-4 w-4 shrink-0 text-brand-200" aria-hidden="true" />
                  Print-ready QR images as a ZIP, plus a CSV of every serial
                </li>
                <li className="flex items-center gap-2.5">
                  <Gauge className="h-4 w-4 shrink-0 text-brand-200" aria-hidden="true" />
                  Your plan&apos;s monthly allowance, with a warning at 80% used
                </li>
              </ul>
            </div>
          </article>

          {/* 2. Factory pairing */}
          <article className="vc-reveal rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
            <Factory className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">Pairing on the line</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Print bottle and cap codes separately, then pair them as caps go on. Factory scanners send signed,
              time-limited requests that cannot be replayed. Pairings can also be recorded by hand.
            </p>
          </article>

          {/* 3. Scan activity */}
          <article className="vc-reveal rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
            <Activity className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">Every scan, recorded</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              See each check by product, label or cap, time and result, and filter down to the scans that were flagged.
            </p>
          </article>

          {/* 4. Alerts and map */}
          <article className="vc-reveal rounded-2xl border border-brand-200 bg-brand-50 p-6 dark:border-brand-500/25 dark:bg-brand-500/10">
            <MapPinned className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">Alerts and a scan map</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              Failed checks, where they happened, scans by state, and batches turning up outside their target state.
            </p>
          </article>

          {/* 5. Team */}
          <article className="vc-reveal flex flex-col justify-between gap-6 rounded-2xl border border-gray-200 bg-white p-6 sm:flex-row sm:items-end lg:col-span-2 dark:border-gray-800 dark:bg-gray-950">
            <div className="max-w-sm">
              <Users className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">Your whole team, with the right access</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                Give factory and distribution staff their own sign-in. Each person sees only what their role allows.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2 sm:justify-end">
              {MANUFACTURER_ROLE_LIST.map((r) => (
                <li
                  key={r}
                  className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                  {TEAM_ROLE_LABELS[r]}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  )
}

export function FraudChecks() {
  const rules = [
    {
      icon: Repeat,
      title: "Repeat scans",
      body: "One bottle label checked from 3 or more different phones in 24 hours.",
    },
    {
      icon: Copy,
      title: "Copied codes",
      body: "A single-code product checked from more than one phone, the sign of a photocopied label.",
    },
    {
      icon: Route,
      title: "Impossible travel",
      body: "The same unit scanned in two places at least 50 km apart, faster than anyone could travel between them.",
    },
    {
      icon: MapPinned,
      title: "Outside the target state",
      body: `A unit scanned more than ${DRIFT_RADIUS_KM} km from the state its batch was made for.`,
    },
    {
      icon: Bot,
      title: "Automated scanning",
      body: "Bursts of checks from one device or network that no person could make by hand.",
    },
  ]

  return (
    <section id="fraud" aria-labelledby="fraud-heading" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
        <SectionHeading id="fraud-heading" eyebrow="Fraud detection" title="Fraud checks that run every night">
          Reused caps and mismatched caps are flagged the moment they are scanned. Then, once a day, VerifyChain looks
          across all your scans for patterns no single check can see, and raises an alert for each one it finds.
        </SectionHeading>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          <ul className="space-y-3">
            <li className="vc-reveal flex gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-500/25 dark:bg-red-500/10">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-red-900 dark:text-red-100">At the moment of the scan</p>
                <p className="mt-1 text-sm leading-relaxed text-red-900/80 dark:text-red-100/80">
                  A cap opened before, a cap from a different bottle, or a cap scanned before its bottle.
                </p>
              </div>
            </li>
            {rules.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="vc-reveal flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="vc-reveal rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8 lg:sticky lg:top-24 dark:border-gray-800 dark:bg-gray-900/60">
            <p className="flex items-baseline gap-3">
              <span className="text-6xl font-semibold tracking-tight text-brand-700 dark:text-brand-400">
                {NIGERIAN_STATES.length}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">regions covered</span>
            </p>
            <div className="mt-6 flex items-center gap-3">
              <BellRing className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Every state and the FCT</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Batches can target any of Nigeria&apos;s 36 states or the FCT, and the location checks know where each one
              is. Location only counts when the shopper agrees to share it.
            </p>
            <ul aria-label="Supported regions" className="mt-6 flex flex-wrap gap-1.5">
              {NIGERIAN_STATES.map((s) => (
                <li
                  key={s.value}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
                >
                  {s.label}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-gray-200 pt-5 text-xs leading-relaxed dark:border-gray-800 text-gray-500 dark:text-gray-400">
              Alerts carry a severity from suspicious to critical. Your dashboard counts the open ones, and
              VerifyChain&apos;s fraud analysts review and resolve them.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
