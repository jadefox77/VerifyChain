// Brand profile rules shared by the dashboard form, the server action and the
// scan pages. Pure, so it can be tested without a database or a request.

export const DEFAULT_BRAND = {
  primaryColor: "#078f5a",
  secondaryColor: "#0b4a34",
  backgroundColor: "#f9fafb",
  fontStyle: "sans",
} as const

export const FONT_STYLES = {
  sans: { label: "Modern sans", stack: "var(--font-plex-sans), ui-sans-serif, system-ui, sans-serif" },
  serif: { label: "Classic serif", stack: "Georgia, Cambria, 'Times New Roman', Times, serif" },
  rounded: { label: "Rounded", stack: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Segoe UI', system-ui, sans-serif" },
} as const

export type FontStyle = keyof typeof FONT_STYLES

export const LINK_FIELDS = [
  { key: "websiteUrl", label: "Official website" },
  { key: "supportUrl", label: "Support page" },
  { key: "instagramUrl", label: "Instagram" },
  { key: "facebookUrl", label: "Facebook" },
  { key: "xUrl", label: "X" },
  { key: "tiktokUrl", label: "TikTok" },
] as const

export type LinkKey = (typeof LINK_FIELDS)[number]["key"]

// What the scan pages and the preview need. No ids, no internal fields.
export type BrandView = {
  name: string
  tagline: string | null
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  fontStyle: FontStyle
  links: { key: LinkKey; label: string; href: string }[]
  supportEmail: string | null
  supportPhone: string | null
}

export type ProductView = {
  name: string
  category: string | null
  description: string | null
  imageUrl: string | null
}

// ── Colours ────────────────────────────────────────────────────────────────

export function normalizeHex(value: unknown): string | null {
  const v = String(value ?? "").trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return null
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// White text unless the colour is too light for it, then near-black. White
// is preferred for mid-tones (such as VerifyChain green) because buttons and
// headings use bold text, which stays readable at 3:1.
export function readableText(bg: string): "#111827" | "#ffffff" {
  return contrastRatio(bg, "#ffffff") >= 3 ? "#ffffff" : "#111827"
}

// ── Links ──────────────────────────────────────────────────────────────────

// Only https links, so a brand cannot put javascript: or plain http links on
// the scan page. "example.com" is accepted and becomes https://example.com.
export function normalizeUrl(value: unknown): string | null | "invalid" {
  let v = String(value ?? "").trim()
  if (!v) return null
  if (v.length > 300) return "invalid"
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = `https://${v}`
  try {
    const u = new URL(v)
    if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password) return "invalid"
    return u.toString()
  } catch {
    return "invalid"
  }
}

export function normalizeEmail(value: unknown): string | null | "invalid" {
  const v = String(value ?? "").trim().toLowerCase()
  if (!v) return null
  if (v.length > 254 || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v)) return "invalid"
  return v
}

export function normalizePhone(value: unknown): string | null | "invalid" {
  const v = String(value ?? "").trim()
  if (!v) return null
  if (!/^\+?[0-9 ()-]{6,20}$/.test(v)) return "invalid"
  return v
}

// ── Form parsing ───────────────────────────────────────────────────────────

export type BrandInput = {
  enabled: boolean
  displayName: string | null
  tagline: string | null
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  fontStyle: FontStyle
  supportEmail: string | null
  supportPhone: string | null
} & Record<LinkKey, string | null>

export type BrandError = "bad_color" | "bad_link" | "bad_email" | "bad_phone"

function text(value: unknown, max: number): string | null {
  const v = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max)
  return v || null
}

export function parseBrandForm(
  get: (key: string) => unknown
): { ok: true; value: BrandInput } | { ok: false; error: BrandError; field?: string } {
  const primaryColor = normalizeHex(get("primaryColor"))
  const secondaryColor = normalizeHex(get("secondaryColor"))
  const backgroundColor = normalizeHex(get("backgroundColor"))
  if (!primaryColor || !secondaryColor || !backgroundColor) return { ok: false, error: "bad_color" }

  const font = String(get("fontStyle") ?? "")
  const fontStyle: FontStyle = font in FONT_STYLES ? (font as FontStyle) : "sans"

  const links = {} as Record<LinkKey, string | null>
  for (const { key } of LINK_FIELDS) {
    const url = normalizeUrl(get(key))
    if (url === "invalid") return { ok: false, error: "bad_link", field: key }
    links[key] = url
  }

  const supportEmail = normalizeEmail(get("supportEmail"))
  if (supportEmail === "invalid") return { ok: false, error: "bad_email" }
  const supportPhone = normalizePhone(get("supportPhone"))
  if (supportPhone === "invalid") return { ok: false, error: "bad_phone" }

  return {
    ok: true,
    value: {
      enabled: get("enabled") === "on" || get("enabled") === "true",
      displayName: text(get("displayName"), 80),
      tagline: text(get("tagline"), 140),
      primaryColor,
      secondaryColor,
      backgroundColor,
      fontStyle,
      supportEmail,
      supportPhone,
      ...links,
    },
  }
}

// ── Images ─────────────────────────────────────────────────────────────────

export const MAX_IMAGE_BYTES = 300 * 1024

// Decides the image type from its first bytes, not from the file name or the
// browser's claim. SVG and GIF are refused: SVG can carry scripts.
export function sniffImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png"
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp"
  }
  return null
}

export function brandImageUrl(id: string | null | undefined): string | null {
  return id ? `/api/brand-image/${id}` : null
}

// ── View model ─────────────────────────────────────────────────────────────

type ProfileLike = {
  displayName: string | null
  tagline: string | null
  logoImageId: string | null
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  fontStyle: string
  supportEmail: string | null
  supportPhone: string | null
} & Record<LinkKey, string | null>

export function toBrandView(profile: ProfileLike, companyName: string, logoUrl?: string | null): BrandView {
  return {
    name: profile.displayName || companyName,
    tagline: profile.tagline,
    logoUrl: logoUrl !== undefined ? logoUrl : brandImageUrl(profile.logoImageId),
    primaryColor: normalizeHex(profile.primaryColor) ?? DEFAULT_BRAND.primaryColor,
    secondaryColor: normalizeHex(profile.secondaryColor) ?? DEFAULT_BRAND.secondaryColor,
    backgroundColor: normalizeHex(profile.backgroundColor) ?? DEFAULT_BRAND.backgroundColor,
    fontStyle: profile.fontStyle in FONT_STYLES ? (profile.fontStyle as FontStyle) : "sans",
    links: LINK_FIELDS.flatMap(({ key, label }) => {
      const href = profile[key]
      // Checked again on the way out, in case a value was written some other way
      const safe = href ? normalizeUrl(href) : null
      return safe && safe !== "invalid" ? [{ key, label, href: safe }] : []
    }),
    supportEmail: profile.supportEmail,
    supportPhone: profile.supportPhone,
  }
}

// Mixes a colour with white, like CSS color-mix(in srgb, hex pct%, white).
function tintHex(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * (pct / 100) + 255 * (1 - pct / 100)))
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`
}

// CSS variables for the branded frame. The brand-* scale is rebuilt from the
// primary colour so existing buttons pick it up, while result colours (green,
// amber, red) are fixed classes and do not change.
export function brandCssVars(brand: Pick<BrandView, "primaryColor" | "secondaryColor" | "backgroundColor">) {
  const p = brand.primaryColor
  const mix = (pct: number, other: string) => `color-mix(in srgb, ${p} ${pct}%, ${other})`
  return {
    "--color-brand-50": mix(8, "white"),
    "--color-brand-100": mix(16, "white"),
    "--color-brand-200": mix(30, "white"),
    "--color-brand-300": mix(50, "white"),
    "--color-brand-400": mix(75, "white"),
    "--color-brand-500": mix(90, "white"),
    "--color-brand-600": p,
    "--color-brand-700": mix(85, "black"),
    "--color-brand-800": mix(70, "black"),
    "--color-brand-900": mix(55, "black"),
    "--brand-on-primary": readableText(p),
    // Dark mode buttons use brand-500
    "--brand-on-primary-dark": readableText(tintHex(p, 90)),
    "--brand-secondary": brand.secondaryColor,
    "--brand-on-secondary": readableText(brand.secondaryColor),
    "--brand-bg": brand.backgroundColor,
    "--brand-on-bg": readableText(brand.backgroundColor),
  } as Record<string, string>
}
