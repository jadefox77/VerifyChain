import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { BookOpen, KeyRound } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/workspace"
import { generateApiKey, parseDomains } from "@/lib/api-keys"
import { lastLagosDays } from "@/lib/lagos-time"
import { PageHeader } from "@/components/ui/page-header"
import { Notice } from "@/components/ui/auth-shell"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { SubmitButton } from "@/components/ui/submit-button"
import { formatDate, timeAgo } from "@/lib/format"
import {
  buttonPrimary,
  buttonSecondary,
  card,
  cardHeader,
  cardTitle,
  fieldHint,
  fieldLabel,
  inputBase,
  tableHead,
} from "@/lib/ui"

export const metadata: Metadata = { title: "API keys" }

// The new key is handed from the server action to the page in a short-lived
// httpOnly cookie, so it never appears in the URL, history or logs. Only its
// hash is stored, so this is the one time anyone can see it.
const NEW_KEY_COOKIE = "vc_new_api_key"
const PATH = "/dashboard/developers"
const MAX_ACTIVE_KEYS = 10
const USAGE_DAYS = 14

const ERRORS: Record<string, string> = {
  missing_name: "Give the key a name, such as \"Main website\".",
  bad_domain: "One of the domains does not look right. Use hostnames such as shop.yourbrand.com.",
  need_domain: "A publishable key needs at least one allowed domain.",
  too_many: `You can have up to ${MAX_ACTIVE_KEYS} active keys. Revoke one you no longer use first.`,
  not_found: "That key was not found.",
}

async function readNewKey(): Promise<{ key: string; kind: string } | null> {
  const raw = (await cookies()).get(NEW_KEY_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.key === "string" && typeof parsed?.kind === "string") return parsed
  } catch {
    // Ignore a malformed cookie
  }
  return null
}

export default async function DevelopersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string; saved?: string }>
}) {
  const { manufacturer } = await requireWorkspace("manageApi")
  const params = await searchParams
  const newKey = params.created === "true" ? await readNewKey() : null
  const errorMessage = params.error ? (ERRORS[params.error] ?? "That did not work. Please try again.") : null

  const days = lastLagosDays(USAGE_DAYS)
  const keys = await prisma.apiKey.findMany({
    where: { manufacturerId: manufacturer.id },
    orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      prefix: true,
      allowedDomains: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      usage: {
        where: { day: { gte: days[0].key } },
        select: { day: true, requests: true, authentic: true, warnings: true, notFound: true, rejected: true },
      },
    },
  })

  const totals = (rows: { requests: number; authentic: number; warnings: number; notFound: number; rejected: number }[]) =>
    rows.reduce(
      (t, r) => ({
        requests: t.requests + r.requests,
        authentic: t.authentic + r.authentic,
        warnings: t.warnings + r.warnings,
        notFound: t.notFound + r.notFound,
        rejected: t.rejected + r.rejected,
      }),
      { requests: 0, authentic: 0, warnings: 0, notFound: 0, rejected: 0 }
    )

  const byDay = days.map(({ key }) => ({ key, ...totals(keys.flatMap((k) => k.usage.filter((u) => u.day === key))) }))
  const overall = totals(byDay)
  const activeKeys = keys.filter((k) => !k.revokedAt)

  return (
    <div className="space-y-6">
      <PageHeader
        title="API keys"
        description="Let your own website or app check your products with the same engine as VerifyChain's scan pages. Each key only checks your own products."
        actions={
          <Link href="/developers" className={buttonSecondary}>
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            API docs
          </Link>
        }
      />

      {newKey && (
        <section className="space-y-4 rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-500/30 dark:bg-brand-500/10">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-brand-900 dark:text-brand-200">Copy your new key now</h2>
          </div>
          <p className="text-sm text-brand-900/80 dark:text-brand-100/80">
            This is the only time the full key is shown. We store only a fingerprint of it, so if you lose it, revoke it and
            create a new one. It disappears from this page within two minutes.
            {newKey.kind === "SECRET"
              ? " Keep this secret key on your server. Never put it in website code that browsers download."
              : " This publishable key is meant for your website's code, and only works from the domains you listed."}
          </p>
          <p className="break-all rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-950/60 dark:text-white">
            {newKey.key}
          </p>
          <form action={clearNewKey}>
            <button type="submit" className={buttonPrimary}>
              I have saved this key
            </button>
          </form>
        </section>
      )}
      {params.created === "true" && !newKey && (
        <Notice tone="info">The key was created. For security, it is no longer shown. If it was not saved, revoke it and create another.</Notice>
      )}
      {params.saved === "true" && <Notice tone="success">Saved.</Notice>}
      {errorMessage && <Notice tone="error">{errorMessage}</Notice>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <section className={card} aria-labelledby="create-key">
          <div className={cardHeader}>
            <h2 id="create-key" className={cardTitle}>
              Create a key
            </h2>
          </div>
          <form action={createKey} className="space-y-5 p-5">
            <div className="space-y-1.5">
              <label htmlFor="name" className={fieldLabel}>
                Name
              </label>
              <input id="name" name="name" required maxLength={60} placeholder="Main website" className={inputBase} />
            </div>
            <fieldset className="space-y-2">
              <legend className={fieldLabel}>Where it will be used</legend>
              {[
                {
                  value: "PUBLISHABLE",
                  title: "In the browser (publishable key)",
                  body: "For a check built into your website's pages. Only works from the domains below.",
                },
                {
                  value: "SECRET",
                  title: "On your server (secret key)",
                  body: "For your backend or a mobile app's server. Refused if sent from a browser.",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-3 has-[:checked]:border-brand-600 dark:border-gray-800 dark:has-[:checked]:border-brand-400"
                >
                  <input type="radio" name="kind" value={opt.value} defaultChecked={opt.value === "PUBLISHABLE"} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">{opt.title}</span>
                    <span className={fieldHint}>{opt.body}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="space-y-1.5">
              <label htmlFor="domains" className={fieldLabel}>
                Allowed domains
              </label>
              <textarea
                id="domains"
                name="domains"
                rows={3}
                placeholder={"yourbrand.com\nshop.yourbrand.com"}
                className={`${inputBase} resize-y font-mono`}
              />
              <p className={fieldHint}>
                One per line. Use *.yourbrand.com for every subdomain. Add localhost while testing. Needed for publishable keys,
                ignored for secret keys.
              </p>
            </div>
            <SubmitButton className={`${buttonPrimary} w-full`} pendingLabel="Creating">
              Create key
            </SubmitButton>
          </form>
        </section>

        <div className="space-y-6">
          <section className={card} aria-labelledby="key-list">
            <div className={cardHeader}>
              <h2 id="key-list" className={cardTitle}>
                Your keys
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {activeKeys.length} active of {MAX_ACTIVE_KEYS}
              </span>
            </div>
            {keys.length === 0 ? (
              <EmptyState
                icon={KeyRound}
                title="No keys yet"
                description="Create a key to start checking products from your own website or app."
              />
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {keys.map((k) => {
                  const t = totals(k.usage)
                  return (
                    <li key={k.id} className={`space-y-3 px-5 py-4 ${k.revokedAt ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{k.name}</p>
                          <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">{k.prefix}...</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Created {formatDate(k.createdAt)} · {k.lastUsedAt ? `Last used ${timeAgo(k.lastUsedAt)}` : "Never used"} ·{" "}
                            {t.requests} {t.requests === 1 ? "request" : "requests"} in {USAGE_DAYS} days
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={k.kind === "SECRET" ? "violet" : "info"}>
                            {k.kind === "SECRET" ? "Secret" : "Publishable"}
                          </Badge>
                          {k.revokedAt && <Badge tone="bad">Revoked {formatDate(k.revokedAt)}</Badge>}
                        </div>
                      </div>
                      {!k.revokedAt && (
                        <div className="flex flex-wrap items-end gap-2">
                          {k.kind === "PUBLISHABLE" && (
                            <form action={updateDomains} className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                              <input type="hidden" name="keyId" value={k.id} />
                              <div className="min-w-[14rem] flex-1 space-y-1">
                                <label htmlFor={`domains-${k.id}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Allowed domains
                                </label>
                                <input
                                  id={`domains-${k.id}`}
                                  name="domains"
                                  defaultValue={k.allowedDomains.join(", ")}
                                  className={`${inputBase} py-1.5 font-mono text-xs`}
                                />
                              </div>
                              <SubmitButton className={`${buttonSecondary} py-1.5`} pendingLabel="Saving">
                                Save domains
                              </SubmitButton>
                            </form>
                          )}
                          <form action={revokeKey}>
                            <input type="hidden" name="keyId" value={k.id} />
                            <SubmitButton className={`${buttonSecondary} py-1.5 text-red-700 dark:text-red-300`} pendingLabel="Revoking">
                              Revoke
                            </SubmitButton>
                          </form>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className={card} aria-labelledby="usage">
            <div className={cardHeader}>
              <h2 id="usage" className={cardTitle}>
                Usage, last {USAGE_DAYS} days
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">Lagos time, all keys</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className={tableHead}>Day</th>
                    <th className={`${tableHead} text-right`}>Requests</th>
                    <th className={`${tableHead} text-right`}>Authentic</th>
                    <th className={`${tableHead} text-right`}>Warnings</th>
                    <th className={`${tableHead} text-right`}>Not found or invalid</th>
                    <th className={`${tableHead} text-right`}>Refused</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[...byDay].reverse().map((d) => (
                    <tr key={d.key} className="text-gray-700 dark:text-gray-300">
                      <td className="px-4 py-2 font-mono text-xs">{d.key}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.requests}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.authentic}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.warnings}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.notFound}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.rejected}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-200 font-medium text-gray-900 dark:border-gray-800 dark:text-white">
                  <tr>
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right tabular-nums">{overall.requests}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{overall.authentic}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{overall.warnings}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{overall.notFound}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{overall.rejected}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className={`${fieldHint} px-5 py-3`}>
              Refused means the request never reached a check: a wrong domain, bad input, or too many requests. Checks made
              through the API also appear in Scan activity and the fraud rules, like any other scan.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

async function clearNewKey() {
  "use server"
  ;(await cookies()).delete({ name: NEW_KEY_COOKIE, path: PATH })
  redirect(PATH)
}

async function createKey(formData: FormData) {
  "use server"
  const { manufacturer, userId } = await requireWorkspace("manageApi")

  const name = String(formData.get("name") ?? "").trim().slice(0, 60)
  if (!name) redirect(`${PATH}?error=missing_name`)
  const kind = formData.get("kind") === "SECRET" ? "SECRET" : "PUBLISHABLE"
  const domains = parseDomains(String(formData.get("domains") ?? ""))
  if (!domains.ok) redirect(`${PATH}?error=bad_domain`)
  if (kind === "PUBLISHABLE" && domains.domains.length === 0) redirect(`${PATH}?error=need_domain`)

  const active = await prisma.apiKey.count({ where: { manufacturerId: manufacturer.id, revokedAt: null } })
  if (active >= MAX_ACTIVE_KEYS) redirect(`${PATH}?error=too_many`)

  const { key, prefix, hash } = generateApiKey(kind)
  await prisma.$transaction(async (tx) => {
    const created = await tx.apiKey.create({
      data: {
        manufacturerId: manufacturer.id,
        name,
        kind,
        prefix,
        keyHash: hash,
        allowedDomains: kind === "PUBLISHABLE" ? domains.domains : [],
        createdById: userId,
      },
      select: { id: true },
    })
    await tx.auditLog.create({
      data: {
        userId,
        action: "API_KEY_CREATED",
        targetType: "ApiKey",
        targetId: created.id,
        after: JSON.stringify({ name, kind, prefix, allowedDomains: kind === "PUBLISHABLE" ? domains.domains : [] }),
      },
    })
  })

  ;(await cookies()).set(NEW_KEY_COOKIE, JSON.stringify({ key, kind }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: PATH,
    maxAge: 120,
  })
  redirect(`${PATH}?created=true`)
}

async function findKey(formData: FormData, manufacturerId: string) {
  const keyId = String(formData.get("keyId") ?? "")
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, manufacturerId, revokedAt: null },
    select: { id: true, kind: true, allowedDomains: true },
  })
  if (!key) redirect(`${PATH}?error=not_found`)
  return key
}

// Takes effect on the key's next request: every request looks the key up.
async function revokeKey(formData: FormData) {
  "use server"
  const { manufacturer, userId } = await requireWorkspace("manageApi")
  const key = await findKey(formData, manufacturer.id)

  await prisma.$transaction([
    prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date(), revokedById: userId } }),
    prisma.auditLog.create({
      data: { userId, action: "API_KEY_REVOKED", targetType: "ApiKey", targetId: key.id },
    }),
  ])
  redirect(`${PATH}?saved=true`)
}

async function updateDomains(formData: FormData) {
  "use server"
  const { manufacturer, userId } = await requireWorkspace("manageApi")
  const key = await findKey(formData, manufacturer.id)

  const domains = parseDomains(String(formData.get("domains") ?? ""))
  if (!domains.ok) redirect(`${PATH}?error=bad_domain`)
  if (key.kind === "PUBLISHABLE" && domains.domains.length === 0) redirect(`${PATH}?error=need_domain`)

  await prisma.$transaction([
    prisma.apiKey.update({ where: { id: key.id }, data: { allowedDomains: domains.domains } }),
    prisma.auditLog.create({
      data: {
        userId,
        action: "API_KEY_DOMAINS_CHANGED",
        targetType: "ApiKey",
        targetId: key.id,
        before: JSON.stringify({ allowedDomains: key.allowedDomains }),
        after: JSON.stringify({ allowedDomains: domains.domains }),
      },
    }),
  ])
  redirect(`${PATH}?saved=true`)
}
