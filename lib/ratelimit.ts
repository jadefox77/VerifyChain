import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

export const redis = Redis.fromEnv()

// One phone. The device id comes from the anonymous vc_device cookie, so
// shoppers who share a mobile network IP do not share this limit.
export const verifyRatelimit = new Ratelimit({
  redis,
  prefix: "rl:verify",
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
})

// One IP address. MTN, Airtel and Glo put many phones behind one IP, so this
// is only a ceiling against floods, set far above what one person can do.
export const verifyIpRatelimit = new Ratelimit({
  redis,
  prefix: "rl:verify-ip",
  limiter: Ratelimit.slidingWindow(120, "1 m"),
  analytics: true,
})

// Requests that arrive without a device cookie, per IP. A script that throws
// its cookies away gets a new device id each time, so this stops it from
// slipping past the per-device limit while staying generous to real
// first-time shoppers on a shared IP.
export const verifyNewDeviceRatelimit = new Ratelimit({
  redis,
  prefix: "rl:verify-new-device",
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
})

export const webhookRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
})

// Password sign-in attempts, per email address and per IP address.
export const loginEmailRatelimit = new Ratelimit({
  redis,
  prefix: "rl:login-email",
  limiter: Ratelimit.slidingWindow(10, "15 m"),
})

export const loginIpRatelimit = new Ratelimit({
  redis,
  prefix: "rl:login-ip",
  limiter: Ratelimit.slidingWindow(30, "15 m"),
})

// Checks a limit, but lets the request through if Redis cannot be reached.
// An Upstash outage should not stop every shopper from checking a product.
export async function allowRequest(
  limiter: Ratelimit,
  key: string
): Promise<boolean> {
  try {
    const { success } = await limiter.limit(key)
    return success
  } catch (error) {
    console.error("Rate limit check failed, allowing the request:", error)
    return true
  }
}

// Clears a limit, for example after a correct password. Never throws.
export async function resetLimit(limiter: Ratelimit, key: string): Promise<void> {
  try {
    await limiter.resetUsedTokens(key)
  } catch (error) {
    console.error("Rate limit reset failed:", error)
  }
}
