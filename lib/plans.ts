import type { SubscriptionPlan } from "@prisma/client"
import { prisma } from "@/lib/prisma"

// Monthly unit allowance per plan. Infinity means no limit.
export const PLAN_LIMITS: Record<SubscriptionPlan, number> = {
  FREE: 5000,
  STARTER: 50000,
  PROFESSIONAL: 500000,
  ENTERPRISE: Infinity,
}

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  FREE: 0,
  STARTER: 150000,
  PROFESSIONAL: 500000,
  ENTERPRISE: 1500000,
}

export const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  FREE: ["Up to 5,000 units a month", "Shopper verification", "Standard support"],
  STARTER: ["Up to 50,000 units a month", "Fraud alerts", "Scan analytics", "Email support"],
  PROFESSIONAL: [
    "Up to 500,000 units a month",
    "Fraud alerts and scan map",
    "Location analytics",
    "Supply chain monitoring",
    "Priority support",
  ],
  ENTERPRISE: [
    "Unlimited units",
    "Full platform access",
    "Dedicated fraud analyst",
    "Custom integrations",
    "24/7 support",
    "Regulatory reporting",
  ],
}

// Show a warning once this share of the allowance is used.
export const WARN_AT = 0.8

const LAGOS_OFFSET_MS = 60 * 60 * 1000 // West Africa Time, UTC+1, no daylight saving

// Allowances reset at midnight on the 1st, Lagos time.
export function monthWindow(now = new Date()) {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS)
  const y = lagos.getUTCFullYear()
  const m = lagos.getUTCMonth()
  const start = new Date(Date.UTC(y, m, 1) - LAGOS_OFFSET_MS)
  const next = new Date(Date.UTC(y, m + 1, 1) - LAGOS_OFFSET_MS)
  return { start, next }
}

export type UsageState = "ok" | "near" | "over"

export type MonthlyUsage = {
  plan: SubscriptionPlan
  used: number
  limit: number
  unlimited: boolean
  remaining: number
  percent: number
  state: UsageState
  resetsOn: Date
}

export function describeUsage(plan: SubscriptionPlan, used: number, now = new Date()): MonthlyUsage {
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE
  const unlimited = limit === Infinity
  const { next } = monthWindow(now)
  const percent = unlimited ? 0 : Math.min((used / limit) * 100, 100)
  const state: UsageState = unlimited ? "ok" : used >= limit ? "over" : used >= limit * WARN_AT ? "near" : "ok"
  return {
    plan,
    used,
    limit,
    unlimited,
    remaining: unlimited ? Infinity : Math.max(limit - used, 0),
    percent,
    state,
    resetsOn: next,
  }
}

// Units serialised this month count towards the allowance.
// Pass a transaction client as db to count inside that transaction.
export async function getMonthlyUsage(
  manufacturerId: string,
  plan: SubscriptionPlan,
  db: Pick<typeof prisma, "bottle"> = prisma
): Promise<MonthlyUsage> {
  const { start } = monthWindow()
  const used = await db.bottle.count({
    where: { manufacturerId, createdAt: { gte: start } },
  })
  return describeUsage(plan, used)
}
