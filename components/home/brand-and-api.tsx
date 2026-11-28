import Link from "next/link"
import { ArrowRight, Globe, ImageIcon, KeyRound, Palette, ServerCog, Type } from "lucide-react"
import { BrandShell, ProductCard } from "@/components/verify/brand-shell"
import { ResultCard } from "@/components/verify/result-card"
import { DEFAULT_BRAND, type BrandView } from "@/lib/brand"
import { buttonSecondary } from "@/lib/ui"
import { SectionHeading } from "./chrome"

// A made-up brand, clearly labelled as an example, rendered with the same
// BrandShell and ResultCard the real scan pages use.
const EXAMPLE_BRAND: BrandView = {
  name: "Your Brand",
  tagline: "Example brand page",
  logoUrl: null,
  primaryColor: "#1d4ed8",
  secondaryColor: "#172554",
  backgroundColor: "#eef2ff",
  fontStyle: DEFAULT_BRAND.fontStyle,
  links: [
    { key: "websiteUrl", label: "Official website", href: "#brands" },
    { key: "instagramUrl", label: "Instagram", href: "#brands" },
    { key: "supportUrl", label: "Support page", href: "#brands" },
  ],
  supportEmail: null,
  supportPhone: null,
}

export function BrandPages() {
  const points = [
    { icon: ImageIcon, title: "Logo and product pictures", body: "Shown above the result, with each product's description." },
    { icon: Palette, title: "Your colours", body: "Header, buttons and background follow your brand." },
    { icon: Type, title: "Font style and tagline", body: "Pick a modern, classic or rounded look." },
    { icon: Globe, title: "Your website and socials", body: "A button to your official site, plus support and social links." },
  ]

  return (
    <section id="brands" aria-labelledby="brands-heading" className="scroll-mt-20 border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 md:py-24 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="vc-reveal order-last lg:order-first">
          {/* inert: a picture of the page, so its links and headings stay out of reach */}
          <div inert className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-xl shadow-gray-900/5 dark:border-gray-800 dark:bg-gray-950 [&_h1]:text-lg">
            <BrandShell brand={EXAMPLE_BRAND} fullHeight={false} host={null}>
              <ResultCard
                tone="good"
                title="Genuine product"
                message="This Orange Drink 50cl is genuine. This is the first time the cap has been opened."
                details={[{ label: "Product", value: "Orange Drink 50cl" }]}
              />
              <ProductCard
                product={{
                  name: "Orange Drink 50cl",
                  category: "Soft drinks",
                  description: "Your product description appears here.",
                  imageUrl: null,
                }}
              />
            </BrandShell>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">Example branded scan page</p>
        </div>

        <div>
          <SectionHeading id="brands-heading" title="Your brand on every scan">
            When a shopper scans one of your products, the page they land on can look like yours. Set it up once from the
            dashboard, with a live preview as you go.
          </SectionHeading>
          <ul className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {points.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-[60ch] border-l-2 border-brand-500 pl-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            The result itself keeps VerifyChain&apos;s fixed green, amber and red, and every page tells shoppers to check
            the web address. No brand page can make a warning look like a pass.
          </p>
        </div>
      </div>
    </section>
  )
}

export function DeveloperApi() {
  const request = `curl -X POST "$VERIFYCHAIN_URL/api/v1/verify" \\
  -H "Authorization: Bearer vc_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "code": "<the scanned QR link>" }'`

  const response = `{
  "object": "verification",
  "status": "authentic",
  "message": "This Premium Malt 60cl is genuine. ...",
  "product": { "name": "Premium Malt 60cl" },
  "check": { "layer": "cap", "auth_mode": "paired",
             "first_check": true },
  "request_id": "req_..."
}`

  return (
    <section id="api" aria-labelledby="api-heading" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
        <SectionHeading id="api-heading" title="Run the same check inside your own app">
          Check your codes from your website or app and show the result in your own design. API checks go through the
          same engine as our scan pages, so they count toward first-open and refill detection and are seen by the same
          fraud rules. A key can only check your own products.
        </SectionHeading>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_1fr_0.8fr]">
          <figure className="vc-reveal min-w-0 overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
            <figcaption className="border-b border-gray-800 px-4 py-2.5 font-mono text-xs text-gray-400">Request</figcaption>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-gray-100">
              <code>{request}</code>
            </pre>
          </figure>
          <figure className="vc-reveal min-w-0 overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
            <figcaption className="border-b border-gray-800 px-4 py-2.5 font-mono text-xs text-gray-400">Response</figcaption>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-brand-200">
              <code>{response}</code>
            </pre>
          </figure>
          <div className="vc-reveal flex flex-col gap-5 rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
            <div className="flex gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Publishable keys</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  For your website&apos;s browser code. Only work from the domains you list.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <ServerCog className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Secret keys</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  For your server. Refused if sent from a browser. Revoke any key from the dashboard.
                </p>
              </div>
            </div>
            <Link href="/developers" className={`${buttonSecondary} mt-auto w-full active:scale-[0.98]`}>
              Read the API docs
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
