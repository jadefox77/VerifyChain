import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

export const verifyRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
})

export const webhookRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
})