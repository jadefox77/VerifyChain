import { describe, expect, it } from "vitest"
import {
  brandCssVars,
  normalizeHex,
  normalizeUrl,
  parseBrandForm,
  readableText,
  sniffImageType,
  toBrandView,
} from "@/lib/brand"

const form = (values: Record<string, string>) => (key: string) => values[key] ?? null

const base = { primaryColor: "#078f5a", secondaryColor: "#0b4a34", backgroundColor: "#f9fafb" }

describe("brand colours", () => {
  it("accepts 3 and 6 digit hex and refuses anything else", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc")
    expect(normalizeHex(" #078F5A ")).toBe("#078f5a")
    expect(normalizeHex("red")).toBeNull()
    expect(normalizeHex("#078f5a; background:url(x)")).toBeNull()
  })

  it("picks readable text for light and dark colours", () => {
    expect(readableText("#ffffff")).toBe("#111827")
    expect(readableText("#0b1f4d")).toBe("#ffffff")
    expect(readableText("#ffd400")).toBe("#111827")
  })

  it("rebuilds the brand scale from the primary colour", () => {
    const vars = brandCssVars(base)
    expect(vars["--color-brand-600"]).toBe("#078f5a")
    expect(vars["--brand-on-primary"]).toBe("#ffffff")
  })
})

describe("brand links", () => {
  it("adds https to a bare domain", () => {
    expect(normalizeUrl("yourbrand.com")).toBe("https://yourbrand.com/")
  })

  it("refuses javascript, http and data links", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBe("invalid")
    expect(normalizeUrl("http://yourbrand.com")).toBe("invalid")
    expect(normalizeUrl("data:text/html,hi")).toBe("invalid")
    expect(normalizeUrl("https://user:pass@yourbrand.com")).toBe("invalid")
  })

  it("treats an empty field as no link", () => {
    expect(normalizeUrl("  ")).toBeNull()
  })
})

describe("parseBrandForm", () => {
  it("parses a full form", () => {
    const r = parseBrandForm(
      form({ ...base, enabled: "on", displayName: "  Zobo  Gold ", websiteUrl: "zobo.ng", fontStyle: "serif" })
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.enabled).toBe(true)
    expect(r.value.displayName).toBe("Zobo Gold")
    expect(r.value.websiteUrl).toBe("https://zobo.ng/")
    expect(r.value.fontStyle).toBe("serif")
    expect(r.value.instagramUrl).toBeNull()
  })

  it("falls back to sans for an unknown font", () => {
    const r = parseBrandForm(form({ ...base, fontStyle: "comic" }))
    expect(r.ok && r.value.fontStyle).toBe("sans")
  })

  it("rejects bad colours, links, emails and phones", () => {
    expect(parseBrandForm(form({ ...base, primaryColor: "green" }))).toEqual({ ok: false, error: "bad_color" })
    expect(parseBrandForm(form({ ...base, xUrl: "javascript:alert(1)" }))).toEqual({
      ok: false,
      error: "bad_link",
      field: "xUrl",
    })
    expect(parseBrandForm(form({ ...base, supportEmail: "nope" }))).toEqual({ ok: false, error: "bad_email" })
    expect(parseBrandForm(form({ ...base, supportPhone: "call me" }))).toEqual({ ok: false, error: "bad_phone" })
  })
})

describe("sniffImageType", () => {
  it("recognises PNG, JPEG and WebP by their bytes", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png")
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg")
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")
    expect(sniffImageType(webp)).toBe("image/webp")
  })

  it("refuses SVG, even when named .png", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull()
  })
})

describe("toBrandView", () => {
  it("always keeps the approved company name, whatever the display name", () => {
    const view = toBrandView(
      {
        displayName: "Totally Official Drinks",
        tagline: null,
        logoImageId: null,
        ...base,
        fontStyle: "sans",
        supportEmail: null,
        supportPhone: null,
        websiteUrl: null,
        supportUrl: null,
        instagramUrl: null,
        facebookUrl: null,
        xUrl: null,
        tiktokUrl: null,
      },
      "Zobo Ltd"
    )
    expect(view.name).toBe("Totally Official Drinks")
    expect(view.legalName).toBe("Zobo Ltd")
  })


  const profile = {
    displayName: null,
    tagline: null,
    logoImageId: "abc",
    ...base,
    fontStyle: "unknown",
    supportEmail: null,
    supportPhone: null,
    websiteUrl: "https://zobo.ng/",
    supportUrl: null,
    instagramUrl: "javascript:alert(1)",
    facebookUrl: null,
    xUrl: null,
    tiktokUrl: null,
  }

  it("uses the company name, the logo route and only safe links", () => {
    const view = toBrandView(profile, "Zobo Ltd")
    expect(view.name).toBe("Zobo Ltd")
    expect(view.legalName).toBe("Zobo Ltd")
    expect(view.logoUrl).toBe("/api/brand-image/abc")
    expect(view.fontStyle).toBe("sans")
    expect(view.links.map((l) => l.key)).toEqual(["websiteUrl"])
  })
})
