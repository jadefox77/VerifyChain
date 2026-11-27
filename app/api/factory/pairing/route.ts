import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import crypto from "crypto"
import { z } from "zod"
import { redis } from "@/lib/ratelimit"
import {
  FACTORY_NONCE_TTL_SECONDS,
  checkFactoryRequest,
} from "@/lib/factory-auth"

// ── Authentication ────────────────────────────────────────────────────────────
// Factory scanners sign each request with FACTORY_SECRET, a timestamp and a
// one-time nonce (see lib/factory-auth.ts for the exact format). A request
// older than 5 minutes, or with a nonce already used, is refused, so a
// captured request cannot be replayed.

const NONCE_PREFIX = "factory-nonce:"

// Records the nonce. Returns false if it was already used. If Redis cannot
// be reached the request is allowed (the 5 minute window still applies, and
// duplicate pairings are refused by the database anyway), so a Redis outage
// does not stop the production line.
async function claimNonce(nonce: string): Promise<boolean> {
  try {
    const result = await redis.set(`${NONCE_PREFIX}${nonce}`, 1, {
      nx: true,
      ex: FACTORY_NONCE_TTL_SECONDS,
    })
    return result === "OK"
  } catch (error) {
    console.error("[factory/pairing] nonce check failed, allowing the request:", error)
    return true
  }
}

const bodySchema = z.object({
  bottleSerialId: z.string().min(1).max(20),
  topCapCode: z.string().min(1).max(12).optional(),
  hiddenSerialId: z.string().min(1).max(24).optional(),
  manufacturerId: z.string().min(1).max(40),
  lineId: z.string().max(60).optional(),
  eventType: z.string().max(30).optional(),
})

const AUTH_ERRORS: Record<string, string> = {
  not_configured: "Unauthorized: factory signing is not configured",
  missing_headers: "Unauthorized: X-Factory-Timestamp, X-Factory-Nonce and X-Factory-Token are required",
  bad_nonce: "Unauthorized: X-Factory-Nonce must be 16 to 64 letters, digits, - or _",
  stale: "Unauthorized: request timestamp is more than 5 minutes from server time",
  bad_signature: "Unauthorized: invalid factory token",
  replayed: "Unauthorized: this request was already received",
}

// ── POST — Automatic scanner submission ───────────────────────────────────────
// Body: { bottleSerialId, topCapCode, hiddenSerialId, manufacturerId, lineId? }

export async function POST(req: NextRequest) {
  try {
    // The signature covers the body exactly as sent.
    const rawBody = await req.text()
    const check = checkFactoryRequest({
      secret: process.env.FACTORY_SECRET,
      timestamp: req.headers.get("x-factory-timestamp"),
      nonce: req.headers.get("x-factory-nonce"),
      token: req.headers.get("x-factory-token"),
      rawBody,
      nowSeconds: Math.floor(Date.now() / 1000),
      allowLegacy: process.env.FACTORY_ALLOW_LEGACY_SIGNATURE === "true",
    })
    if (!check.ok) {
      return Response.json({ error: AUTH_ERRORS[check.reason], code: check.reason.toUpperCase() }, { status: 401 })
    }
    if (check.nonce && !(await claimNonce(check.nonce))) {
      return Response.json({ error: AUTH_ERRORS.replayed, code: "REPLAYED" }, { status: 401 })
    }
    if (check.legacy) {
      console.warn("[factory/pairing] accepted a request signed the old way, without timestamp and nonce")
    }

    let json: unknown
    try {
      json = JSON.parse(rawBody)
    } catch {
      return Response.json({ error: "Body must be JSON" }, { status: 400 })
    }
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      bottleSerialId,
      topCapCode,
      hiddenSerialId,
      manufacturerId,
      lineId,
      eventType = "PAIRING",
    } = parsed.data

    if (!bottleSerialId || !manufacturerId) {
      return Response.json(
        { error: "bottleSerialId and manufacturerId are required" },
        { status: 400 }
      )
    }

    // Verify manufacturer exists
    const manufacturer = await prisma.manufacturer.findUnique({
      where: { id: manufacturerId },
      select: { id: true, companyName: true },
    })

    if (!manufacturer) {
      return Response.json(
        { error: "Manufacturer not found" },
        { status: 404 }
      )
    }

    // Find the bottle
    const bottle = await prisma.bottle.findUnique({
      where: { serialId: bottleSerialId },
      include: { cap: true },
    })

    if (!bottle) {
      // Log as a failed pairing event
      await prisma.alertLog.create({
        data: {
          manufacturerId,
          type: "PRODUCTION_PAIRING_FAIL",
          severity: "HIGH_CONCERN",
          message: `Factory scanner submitted unknown bottle serial: ${bottleSerialId}`,
          detail: JSON.stringify({ lineId, topCapCode, hiddenSerialId }),
          confidenceScore: 1.0,
        },
      })

      return Response.json(
        { error: "Bottle serial not found", code: "BOTTLE_NOT_FOUND" },
        { status: 404 }
      )
    }

    // Detect duplicate pairing
    if (bottle.cap) {
      await prisma.alertLog.create({
        data: {
          manufacturerId,
          type: "PRODUCTION_PAIRING_FAIL",
          severity: "HIGH_CONCERN",
          message: `Duplicate pairing attempt on bottle ${bottleSerialId}, which already has a cap`,
          detail: JSON.stringify({ lineId, topCapCode }),
          confidenceScore: 0.95,
        },
      })

      return Response.json(
        {
          error: "Bottle already has a cap paired",
          code: "DUPLICATE_PAIRING",
        },
        { status: 409 }
      )
    }

    if (eventType === "PAIRING" && topCapCode && hiddenSerialId) {
      // Verify cap codes don't already exist
      const [existingTop, existingHidden] = await Promise.all([
        prisma.cap.findUnique({ where: { topCode: topCapCode } }),
        prisma.cap.findUnique({ where: { hiddenSerialId } }),
      ])

      if (existingTop || existingHidden) {
        await prisma.alertLog.create({
          data: {
            manufacturerId,
            type: "PRODUCTION_PAIRING_FAIL",
            severity: "CRITICAL",
            message: `Duplicate cap codes read on the production line. The cap may be cloned.`,
            detail: JSON.stringify({ topCapCode, hiddenSerialId, lineId }),
            confidenceScore: 0.98,
          },
        })

        return Response.json(
          {
            error: "Cap identity already exists. The cap may be cloned.",
            code: "DUPLICATE_CAP_IDENTITY",
          },
          { status: 409 }
        )
      }

      // Create the cap pairing
      const hiddenHmacSig = crypto
        .createHmac("sha256", process.env.QR_SECRET!)
        .update(hiddenSerialId)
        .digest("hex")

      await prisma.cap.create({
        data: {
          bottleId: bottle.id,
          topCode: topCapCode,
          hiddenSerialId,
          hiddenHmacSig,
        },
      })

      return Response.json({
        success: true,
        event: "PAIRING_RECORDED",
        bottleId: bottle.id,
        topCapCode,
        timestamp: new Date().toISOString(),
      })
    }

    return Response.json(
      { error: "Invalid event type or missing cap codes" },
      { status: 400 }
    )
  } catch (err) {
    console.error("[factory/pairing]", err)
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ── GET — Health check for scanner connectivity test ─────────────────────────

export async function GET() {
  return Response.json({
    status: "online",
    endpoint: "VerifyChain Factory Pairing API",
    version: "1.0",
    timestamp: new Date().toISOString(),
  })
}