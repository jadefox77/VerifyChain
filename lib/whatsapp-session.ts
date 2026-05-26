// =============================================================================
// VerifyChain Africa — WhatsApp Session Manager
// Replaces in-memory pendingBottleScans Map with Redis
// =============================================================================

import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// ── Key patterns ──────────────────────────────────────────────────────────────

const pendingKey = (phone: string) =>
  `vc:pending:${phone}`

const rateLimitKey = (phone: string) =>
  `vc:ratelimit:${phone}`

// ── Pending scan session ──────────────────────────────────────────────────────
// TTL of 10 minutes — consumer has 10 mins to open bottle and scan cap

const PENDING_TTL_SECONDS = 10 * 60

export async function setPendingScan(
  phone: string,
  bottleSerialId: string
): Promise<void> {
  await redis.set(pendingKey(phone), bottleSerialId, {
    ex: PENDING_TTL_SECONDS,
  })
}

export async function getPendingScan(
  phone: string
): Promise<string | null> {
  const val = await redis.get<string>(pendingKey(phone))
  return val ?? null
}

export async function clearPendingScan(phone: string): Promise<void> {
  await redis.del(pendingKey(phone))
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// 10 verifications per phone number per hour
// Uses sliding window algorithm

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "vc:wa",
  analytics: false,
})

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  reset: number // Unix timestamp ms
}

export async function checkRateLimit(
  phone: string
): Promise<RateLimitResult> {
  const { success, remaining, reset } = await ratelimit.limit(phone)
  return { allowed: success, remaining, reset }
}

// ── Abuse tracking ────────────────────────────────────────────────────────────
// Track phones that repeatedly hit the rate limit

const ABUSE_KEY = "vc:abuse:phones"
const ABUSE_THRESHOLD = 3 // rate limit hits before flagging

export async function trackRateLimitHit(phone: string): Promise<void> {
  const key = `vc:abuse:hits:${phone}`
  const hits = await redis.incr(key)

  // Expire after 24hrs
  if (hits === 1) {
    await redis.expire(key, 24 * 60 * 60)
  }

  if (hits >= ABUSE_THRESHOLD) {
    // Add to abuse set for monitoring
    await redis.sadd(ABUSE_KEY, phone)
  }
}

export async function isAbusivePhone(
  phone: string
): Promise<boolean> {
  const result = await redis.sismember(ABUSE_KEY, phone)
  return result === 1
}