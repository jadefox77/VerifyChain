import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { KeyRound, Users } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/workspace"
import {
  MANUFACTURER_ROLE_LIST,
  TEAM_ROLE_DESCRIPTIONS,
  TEAM_ROLE_LABELS,
  isManufacturerRole,
} from "@/lib/permissions"
import { makeTempPassword, parseNewMember } from "@/lib/team"
import { PageHeader } from "@/components/ui/page-header"
import { Notice } from "@/components/ui/auth-shell"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { SubmitButton } from "@/components/ui/submit-button"
import { formatDate } from "@/lib/format"
import { buttonPrimary, buttonSecondary, card, cardHeader, cardTitle, fieldHint, fieldLabel, inputBase } from "@/lib/ui"

export const metadata: Metadata = { title: "Team" }

// The one-time password is handed from the server action to the page in a
// short-lived httpOnly cookie, so it never appears in the URL, browser
// history or server logs.
const CREDENTIALS_COOKIE = "vc_new_member"
const PATH = "/dashboard/team"

const ERRORS: Record<string, string> = {
  missing: "Name and email are required.",
  bad_email: "That email address does not look right.",
  bad_role: "Choose one of the roles listed.",
  email_exists: "An account with that email already exists and is in use. Ask VerifyChain support if they need to join your team.",
  not_found: "That person is not on your team.",
  self: "You cannot change or remove your own access.",
}

async function readCredentials(): Promise<{ email: string; password: string } | null> {
  const raw = (await cookies()).get(CREDENTIALS_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.email === "string" && typeof parsed?.password === "string") return parsed
  } catch {
    // Ignore a malformed cookie
  }
  return null
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; error?: string; saved?: string }>
}) {
  const { manufacturer, userId } = await requireWorkspace("manageTeam")
  const params = await searchParams
  const credentials = params.added === "true" ? await readCredentials() : null
  const errorMessage = params.error ? (ERRORS[params.error] ?? "That did not work. Please try again.") : null

  const [owner, members] = await Promise.all([
    prisma.user.findUnique({
      where: { id: manufacturer.userId },
      select: { name: true, email: true },
    }),
    prisma.user.findMany({
      where: { teamManufacturerId: manufacturer.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, mustResetPassword: true, createdAt: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Give factory and distribution staff their own sign-in. Each person sees only what their role allows."
      />

      {credentials && (
        <section className="space-y-4 rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-500/30 dark:bg-brand-500/10">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-brand-900 dark:text-brand-200">Team member added</h2>
          </div>
          <p className="text-sm text-brand-900/80 dark:text-brand-100/80">
            Pass these details on securely. The temporary password is shown only here and disappears within two minutes.
            They will choose a new password the first time they sign in.
          </p>
          <dl className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white text-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-950/60">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <dt className="text-gray-500 dark:text-gray-400">Email</dt>
              <dd className="break-all text-gray-900 dark:text-white">{credentials.email}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <dt className="text-gray-500 dark:text-gray-400">Temporary password</dt>
              <dd className="font-mono font-semibold tracking-wider text-amber-700 dark:text-amber-300">{credentials.password}</dd>
            </div>
          </dl>
          <form action={clearCredentials}>
            <button type="submit" className={buttonPrimary}>
              I have saved these details
            </button>
          </form>
        </section>
      )}

      {params.added === "true" && !credentials && (
        <Notice tone="info">
          The team member was added. For security, the temporary password is no longer shown. If it was not passed on,
          remove them and add them again.
        </Notice>
      )}
      {params.saved === "true" && <Notice tone="success">Saved.</Notice>}
      {errorMessage && <Notice tone="error">{errorMessage}</Notice>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <section className={card} aria-labelledby="add-member">
          <div className={cardHeader}>
            <h2 id="add-member" className={cardTitle}>
              Add a team member
            </h2>
          </div>
          <form action={addMember} className="space-y-5 p-5">
            <div className="space-y-1.5">
              <label htmlFor="name" className={fieldLabel}>
                Full name
              </label>
              <input id="name" name="name" required maxLength={120} className={inputBase} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className={fieldLabel}>
                Email address
              </label>
              <input id="email" name="email" type="email" required maxLength={254} className={inputBase} />
            </div>
            <fieldset className="space-y-2">
              <legend className={fieldLabel}>Role</legend>
              {MANUFACTURER_ROLE_LIST.map((role) => (
                <label
                  key={role}
                  className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-3 has-[:checked]:border-brand-600 dark:border-gray-800 dark:has-[:checked]:border-brand-400"
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    defaultChecked={role === "FACTORY_OPERATOR"}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">{TEAM_ROLE_LABELS[role]}</span>
                    <span className={fieldHint}>{TEAM_ROLE_DESCRIPTIONS[role]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <SubmitButton className={`${buttonPrimary} w-full`} pendingLabel="Adding">
              Add team member
            </SubmitButton>
          </form>
        </section>

        <section className={card} aria-labelledby="member-list">
          <div className={cardHeader}>
            <h2 id="member-list" className={cardTitle}>
              People with access
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">{members.length + 1} total</span>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {owner && (
              <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{owner.name ?? owner.email}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{owner.email}</p>
                </div>
                <Badge tone="brand">Account owner</Badge>
              </li>
            )}
            {members.map((m) => (
              <li key={m.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{m.name ?? m.email}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {m.email} · Added {formatDate(m.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isManufacturerRole(m.role) && <Badge tone="neutral">{TEAM_ROLE_LABELS[m.role]}</Badge>}
                    {m.mustResetPassword && <Badge tone="warn">Not signed in yet</Badge>}
                  </div>
                </div>
                {m.id !== userId && (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={changeRole} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="memberId" value={m.id} />
                      <label htmlFor={`role-${m.id}`} className="sr-only">
                        Role for {m.email}
                      </label>
                      <select
                        id={`role-${m.id}`}
                        name="role"
                        defaultValue={m.role}
                        className={`${inputBase} w-auto py-1.5`}
                      >
                        {MANUFACTURER_ROLE_LIST.map((role) => (
                          <option key={role} value={role}>
                            {TEAM_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                      <SubmitButton className={`${buttonSecondary} py-1.5`} pendingLabel="Saving">
                        Change role
                      </SubmitButton>
                    </form>
                    <form action={removeMember}>
                      <input type="hidden" name="memberId" value={m.id} />
                      <SubmitButton
                        className={`${buttonSecondary} py-1.5 text-red-700 dark:text-red-300`}
                        pendingLabel="Removing"
                      >
                        Remove
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {members.length === 0 && (
            <EmptyState
              className="py-6"
              icon={Users}
              title="No team members yet"
              description="People you add here sign in with their own email and see only what their role allows."
            />
          )}
        </section>
      </div>
    </div>
  )
}

async function clearCredentials() {
  "use server"
  ;(await cookies()).delete({ name: CREDENTIALS_COOKIE, path: PATH })
  redirect(PATH)
}

async function addMember(formData: FormData) {
  "use server"
  const { manufacturer, userId } = await requireWorkspace("manageTeam")

  const parsed = parseNewMember({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  })
  if (!parsed.ok) redirect(`${PATH}?error=${parsed.error}`)
  const { name, email, role } = parsed.value

  // Never take over an account that is in use: it could belong to another
  // company or to VerifyChain staff. The one exception is someone who was
  // removed from a team earlier (no company, no password, no Google sign-in),
  // who can be added again.
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      role: true,
      password: true,
      teamManufacturerId: true,
      manufacturer: { select: { id: true } },
      _count: { select: { accounts: true } },
    },
  })
  const rejoining =
    existing &&
    isManufacturerRole(existing.role) &&
    !existing.password &&
    !existing.teamManufacturerId &&
    !existing.manufacturer &&
    existing._count.accounts === 0
  if (existing && !rejoining) redirect(`${PATH}?error=email_exists`)

  const tempPassword = makeTempPassword()
  const hashed = await bcrypt.hash(tempPassword, 12)
  const data = {
    name,
    role,
    password: hashed,
    mustResetPassword: true,
    teamManufacturerId: manufacturer.id,
  }

  await prisma.$transaction(async (tx) => {
    const member = existing
      ? await tx.user.update({ where: { id: existing.id }, data })
      : await tx.user.create({ data: { ...data, email } })
    await tx.auditLog.create({
      data: {
        userId,
        action: "TEAM_MEMBER_ADDED",
        targetType: "User",
        targetId: member.id,
        after: JSON.stringify({ role, manufacturerId: manufacturer.id }),
      },
    })
  })

  const shownEmail = existing?.email ?? email
  ;(await cookies()).set(CREDENTIALS_COOKIE, JSON.stringify({ email: shownEmail, password: tempPassword }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: PATH,
    maxAge: 120,
  })
  redirect(`${PATH}?added=true`)
}

// Finds a member of this manufacturer's team, other than the person acting.
async function findMember(formData: FormData, manufacturerId: string, actingUserId: string) {
  const memberId = String(formData.get("memberId") ?? "")
  if (memberId === actingUserId) redirect(`${PATH}?error=self`)
  const member = await prisma.user.findFirst({
    where: { id: memberId, teamManufacturerId: manufacturerId },
    select: { id: true, role: true },
  })
  if (!member) redirect(`${PATH}?error=not_found`)
  return member
}

async function changeRole(formData: FormData) {
  "use server"
  const { manufacturer, userId } = await requireWorkspace("manageTeam")
  const member = await findMember(formData, manufacturer.id, userId)

  const role = String(formData.get("role") ?? "")
  if (!isManufacturerRole(role)) redirect(`${PATH}?error=bad_role`)

  await prisma.$transaction([
    prisma.user.update({ where: { id: member.id }, data: { role } }),
    prisma.auditLog.create({
      data: {
        userId,
        action: "TEAM_MEMBER_ROLE_CHANGED",
        targetType: "User",
        targetId: member.id,
        before: JSON.stringify({ role: member.role }),
        after: JSON.stringify({ role }),
      },
    }),
  ])
  redirect(`${PATH}?saved=true`)
}

// Removing someone takes effect on their next request, because the
// dashboard reads team membership from the database. Their password is
// cleared so the account cannot sign in again; it is kept, not deleted, so
// the audit trail still points at a real user.
async function removeMember(formData: FormData) {
  "use server"
  const { manufacturer, userId } = await requireWorkspace("manageTeam")
  const member = await findMember(formData, manufacturer.id, userId)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: member.id },
      data: { teamManufacturerId: null, password: null, mustResetPassword: false },
    }),
    prisma.auditLog.create({
      data: {
        userId,
        action: "TEAM_MEMBER_REMOVED",
        targetType: "User",
        targetId: member.id,
        before: JSON.stringify({ role: member.role, manufacturerId: manufacturer.id }),
      },
    }),
  ])
  redirect(`${PATH}?saved=true`)
}
