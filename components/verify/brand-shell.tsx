import type { CSSProperties, ReactNode } from "react"
import { ExternalLink, Mail, Phone } from "lucide-react"
import { FONT_STYLES, brandCssVars, type BrandView, type ProductView } from "@/lib/brand"

// The branded frame around the consumer verification screens. The brand
// styles the header, buttons, background and links. The result itself, and
// the VerifyChain mark in the footer, keep fixed colours so a brand page
// cannot make a warning look like a pass. Used by the scan pages and by the
// live preview in the dashboard, so it has no server-only code.

function appHost(): string | null {
  try {
    return process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).host : null
  } catch {
    return null
  }
}

// Fixed-colour mark: never picks up the brand's colours.
function VerifyChainMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="32" height="32" rx="8" fill="#078f5a" />
      <path
        d="M8.5 15.5 14 21.5 23.5 10"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AuthenticityMark({ host = appHost() }: { host?: string | null }) {
  return (
    <div className="mx-auto flex max-w-sm items-start gap-2.5 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-left text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
      <VerifyChainMark className="mt-0.5 h-5 w-5" />
      <p className="leading-relaxed">
        <span className="font-semibold text-gray-900 dark:text-white">Check run by VerifyChain Africa.</span>{" "}
        {host ? (
          <>
            Results are only real on <span className="font-mono font-medium text-gray-900 dark:text-white">{host}</span>.
            Check the address bar.
          </>
        ) : (
          <>Check the address bar before you trust a result.</>
        )}
      </p>
    </div>
  )
}

export function ProductCard({ product }: { product: ProductView }) {
  return (
    <div className="mt-4 flex gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left dark:border-gray-800 dark:bg-gray-900">
      {product.imageUrl && (
        // Served from our own domain; next/image adds nothing for one small picture
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt=""
          className="h-20 w-20 shrink-0 rounded-xl bg-gray-50 object-contain dark:bg-gray-800"
        />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{product.name}</p>
        {product.category && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{product.category}</p>}
        {product.description && (
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{product.description}</p>
        )}
      </div>
    </div>
  )
}

function BrandLinks({ brand }: { brand: BrandView }) {
  const website = brand.links.find((l) => l.key === "websiteUrl")
  const others = brand.links.filter((l) => l.key !== "websiteUrl")
  if (!website && others.length === 0 && !brand.supportEmail && !brand.supportPhone) return null

  return (
    <section aria-label={`${brand.name} links`} className="mx-auto mt-6 w-full max-w-sm space-y-3">
      {website && (
        <a
          href={website.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
          style={{ background: "var(--brand-secondary)", color: "var(--brand-on-secondary)" }}
        >
          Visit {brand.name}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      )}
      {(others.length > 0 || brand.supportEmail || brand.supportPhone) && (
        <ul className="flex flex-wrap justify-center gap-2 text-xs">
          {others.map((l) => (
            <li key={l.key}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                {l.label}
              </a>
            </li>
          ))}
          {brand.supportEmail && (
            <li>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Email
              </a>
            </li>
          )}
          {brand.supportPhone && (
            <li>
              <a
                href={`tel:${brand.supportPhone.replace(/[^+0-9]/g, "")}`}
                className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {brand.supportPhone}
              </a>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

export function BrandShell({
  brand,
  children,
  host,
  fullHeight = true,
}: {
  brand: BrandView
  children: ReactNode
  host?: string | null
  /** false inside the dashboard preview */
  fullHeight?: boolean
}) {
  // The dashboard preview sits inside the dashboard's own <main>
  const Main = fullHeight ? "main" : "div"
  const style = {
    ...brandCssVars(brand),
    fontFamily: FONT_STYLES[brand.fontStyle].stack,
  } as CSSProperties

  return (
    <div
      style={style}
      className={`flex flex-col bg-[var(--brand-bg)] dark:bg-gray-950 ${fullHeight ? "min-h-[100dvh]" : "h-full"}`}
    >
      <div aria-hidden="true" className="h-1.5 w-full" style={{ background: "var(--brand-secondary)" }} />
      <header className="flex flex-col items-center gap-2 px-4 pb-2 pt-6 text-center">
        {brand.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={`${brand.name} logo`} className="h-14 max-w-[200px] object-contain" />
        )}
        <div>
          <p className="text-base font-semibold tracking-tight text-[var(--brand-on-bg)] dark:text-white">
            {brand.name}
          </p>
          {brand.tagline && (
            <p className="mt-0.5 text-xs text-[var(--brand-on-bg)] opacity-75 dark:text-gray-300">{brand.tagline}</p>
          )}
        </div>
      </header>
      <Main id={fullHeight ? "main" : undefined} className="flex flex-1 flex-col items-center px-4 py-6 sm:justify-center">
        <div className="w-full max-w-sm">{children}</div>
        <BrandLinks brand={brand} />
      </Main>
      <footer className="px-4 pb-6">
        <AuthenticityMark host={host} />
      </footer>
    </div>
  )
}
