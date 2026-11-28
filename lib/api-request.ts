import { after, NextResponse, type NextRequest } from "next/server"
import crypto from "crypto"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { verifyBottle } from "@/lib/verify"
import { verifyCap } from "@/lib/verify-cap"
import { verifySignature } from "@/lib/serial"
import { clientIpFrom, hashIp } from "@/lib/request-meta"
import { allowRequest, apiKeyRatelimit, verifyRatelimit } from "@/lib/ratelimit"
import { lagosDayKey } from "@/lib/lagos-time"
import {
  bearerKey,
  bottleToApi,
  capToApi,
  hashApiKey,
  invalidResponse,
  kindOfKey,
  notFoundResponse,
  originAllowed,
  readBottleId,
  readCode,
  usageBucket,
  type ApiVerification,
  type UsageBucket,
} from "@/lib/api-keys"

// The verification API. Brands call it from their own website or app and get
// a result from the same engine the scan pages use (lib/verify.ts and
// lib/verify-cap.ts). A key only ever checks its own brand's codes.

type Layer = "bottle" | "cap"

const bodySchema = z.object({
  code: z.string().min(1).max(500),
  sig: z.string().max(64).optional(),
  bottle_code: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // Secret keys only: the shopper's IP address, if the brand's server knows
  // it. Stored only as a keyed hash, like every other scan.
  shopper_ip: z.string().max(64).optional(),
})

type KeyRow = {
  id: string
  manufacturerId: string
  kind: "SECRET" | "PUBLISHABLE"
  allowedDomains: string[]
  revokedAt: Date | null
  lastUsedAt: Date | null
  manufacturer: { onboardingStatus: string; companyName: string; brandProfile: { displayName: string | null } | null }
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {}
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
}

function json(body: unknown, status: number, requestId: string, cors: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...cors, "Cache-Control": "no-store", "X-Request-Id": requestId },
  })
}

function apiError(status: number, code: string, message: string, requestId: string, cors?: Record<string, string>) {
  return json({ error: { code, message }, request_id: requestId }, status, requestId, cors)
}

// Preflight. Answered for any origin, because the browser sends no key with
// it; the real request is then checked against the key's allowed domains.
export function preflight(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) })
}

const USAGE_COLUMNS: Record<UsageBucket, string> = {
  authentic: "authentic",
  warnings: "warnings",
  notFound: "notFound",
  rejected: "rejected",
}

function recordUsage(key: KeyRow, bucket: UsageBucket) {
  const day = lagosDayKey(new Date())
  const task = async () => {
    try {
      // One atomic statement, so simultaneous requests never lose a count.
      // The column name comes from a fixed list, never from the request.
      const column = Prisma.raw(`"${USAGE_COLUMNS[bucket]}"`)
      await prisma.$executeRaw`
        INSERT INTO "ApiUsageDay" ("apiKeyId", "day", "requests", ${column})
        VALUES (${key.id}, ${day}, 1, 1)
        ON CONFLICT ("apiKeyId", "day")
        DO UPDATE SET "requests" = "ApiUsageDay"."requests" + 1, ${column} = "ApiUsageDay".${column} + 1`
      // At most one write a minute for "last used"
      if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
        await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      }
    } catch (error) {
      console.error("API usage write failed:", error)
    }
  }
  // Written after the response is sent, so counting never slows a check down.
  // Outside a request (tests), it just runs.
  try {
    after(task)
  } catch {
    void task()
  }
}

// Which brand a code belongs to, without recording anything.
async function ownerOf(layer: Layer, id: string): Promise<string | null> {
  if (layer === "bottle") {
    const b = await prisma.bottle.findUnique({ where: { serialId: id }, select: { manufacturerId: true } })
    return b?.manufacturerId ?? null
  }
  const c = await prisma.cap.findUnique({
    where: { hiddenSerialId: id },
    select: { batchId: true, bottle: { select: { manufacturerId: true } } },
  })
  if (c?.bottle) return c.bottle.manufacturerId
  if (c?.batchId) {
    const batch = await prisma.batch.findUnique({ where: { id: c.batchId }, select: { manufacturerId: true } })
    return batch?.manufacturerId ?? null
  }
  return null
}

export async function handleVerify(req: NextRequest, layer: Layer) {
  const requestId = `req_${crypto.randomBytes(9).toString("base64url")}`
  const origin = req.headers.get("origin")

  try {
    // 1. The key
    const raw = bearerKey(req.headers.get("authorization"))
    const kind = raw ? kindOfKey(raw) : null
    if (!raw || !kind) {
      return apiError(401, "missing_key", "Send your API key as: Authorization: Bearer <key>.", requestId, corsHeaders(origin))
    }
    const key: KeyRow | null = await prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(raw) },
      select: {
        id: true,
        manufacturerId: true,
        kind: true,
        allowedDomains: true,
        revokedAt: true,
        lastUsedAt: true,
        manufacturer: {
          select: { onboardingStatus: true, companyName: true, brandProfile: { select: { displayName: true } } },
        },
      },
    })
    if (!key || key.revokedAt || key.kind !== kind) {
      return apiError(401, "invalid_key", "This API key is not valid or has been revoked.", requestId, corsHeaders(origin))
    }
    if (key.manufacturer.onboardingStatus !== "ACTIVE_PRODUCTION") {
      return apiError(403, "account_inactive", "This brand's account is not active.", requestId, corsHeaders(origin))
    }

    // 2. Where it is used from. Secret keys must stay on a server, so a
    // request from a browser (which always sends Origin on a cross-site
    // POST) is refused. Publishable keys only work from the listed domains.
    let cors: Record<string, string> = {}
    if (key.kind === "SECRET" && origin) {
      recordUsage(key, "rejected")
      return apiError(
        403,
        "secret_key_in_browser",
        "Secret keys only work from your server. Use a publishable key in the browser.",
        requestId,
        corsHeaders(origin)
      )
    }
    if (key.kind === "PUBLISHABLE") {
      if (!originAllowed(origin, key.allowedDomains)) {
        recordUsage(key, "rejected")
        return apiError(403, "domain_not_allowed", "This website is not on the key's list of allowed domains.", requestId, corsHeaders(origin))
      }
      cors = corsHeaders(origin)
    }

    // 3. Rate limits: per key, and per shopper for browser keys
    const ip = clientIpFrom(req.headers)
    const limits = [allowRequest(apiKeyRatelimit, `key:${key.id}`)]
    if (key.kind === "PUBLISHABLE") limits.push(allowRequest(verifyRatelimit, `api:pk:${key.id}:${ip}`))
    if ((await Promise.all(limits)).includes(false)) {
      recordUsage(key, "rejected")
      return apiError(429, "rate_limited", "Too many requests. Wait a minute, then try again.", requestId, cors)
    }

    // 4. The body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      recordUsage(key, "rejected")
      return apiError(400, "bad_json", "The request body must be JSON.", requestId, cors)
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      recordUsage(key, "rejected")
      return apiError(400, "bad_request", "Send at least a \"code\" field. See the API docs.", requestId, cors)
    }
    const input = parsed.data

    // 5. The code must be correctly signed and belong to this brand
    const code = readCode(input.code, input.sig, layer)
    let result: ApiVerification
    if (!code || !verifySignature(code.id, code.sig)) {
      result = invalidResponse(layer)
    } else if ((await ownerOf(layer, code.id)) !== key.manufacturerId) {
      result = notFoundResponse(layer)
    } else {
      // The shopper's IP: the caller's IP for a browser key. For a secret key
      // the caller is the brand's server, whose IP would make every shopper
      // look like one source to the fraud rules, so it is only used when the
      // brand passes shopper_ip.
      const shopperIp = key.kind === "PUBLISHABLE" ? ip : input.shopper_ip
      const meta = {
        channel: "api",
        ipHash: shopperIp ? hashIp(shopperIp) : null,
        userAgent: key.kind === "PUBLISHABLE" ? (req.headers.get("user-agent")?.slice(0, 300) ?? null) : null,
        apiKeyId: key.id,
      }
      result =
        layer === "bottle"
          ? bottleToApi(await verifyBottle({ serialId: code.id, lat: input.lat, lng: input.lng, meta }))
          : capToApi(
              await verifyCap({
                hiddenSerialId: code.id,
                bottleSerialIds: readBottleId(input.bottle_code) ? [readBottleId(input.bottle_code)!] : undefined,
                lat: input.lat,
                lng: input.lng,
                meta,
              })
            )
    }

    recordUsage(key, usageBucket(result.status))
    return json(
      {
        object: "verification",
        ...result,
        brand: { name: key.manufacturer.brandProfile?.displayName || key.manufacturer.companyName },
        request_id: requestId,
      },
      200,
      requestId,
      cors
    )
  } catch (error) {
    console.error("Verification API error:", requestId, error)
    return apiError(500, "server_error", "Something went wrong on our side. Try again.", requestId, corsHeaders(origin))
  }
}
