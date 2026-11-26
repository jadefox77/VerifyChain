import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import crypto from "crypto"

// ── Authentication ────────────────────────────────────────────────────────────
// Factory scanners authenticate via HMAC-signed requests.
// Each manufacturer gets a unique FACTORY_SECRET stored in their env.
// Header: X-Factory-Token: HMAC-SHA256(payload, FACTORY_SECRET)

function verifyFactoryToken(
  payload: string,
  token: string
): boolean {
  const secret = process.env.FACTORY_SECRET
  if (!secret) return false
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  // timingSafeEqual throws when lengths differ, which used to turn a bad
  // token into a 500 instead of a 401.
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// ── POST — Automatic scanner submission ───────────────────────────────────────
// Body: { bottleSerialId, topCapCode, hiddenSerialId, manufacturerId, lineId? }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = req.headers.get("x-factory-token")
    const payload = JSON.stringify(body)

    // Verify factory token
    if (!token || !verifyFactoryToken(payload, token)) {
      return Response.json(
        { error: "Unauthorized — invalid factory token" },
        { status: 401 }
      )
    }

    const {
      bottleSerialId,
      topCapCode,
      hiddenSerialId,
      manufacturerId,
      lineId,
      eventType = "PAIRING",
    } = body

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
          message: `Duplicate pairing attempt on bottle ${bottleSerialId} — already has a cap`,
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
            message: `Duplicate cap identity detected on line — possible cloning attempt`,
            detail: JSON.stringify({ topCapCode, hiddenSerialId, lineId }),
            confidenceScore: 0.98,
          },
        })

        return Response.json(
          {
            error: "Cap identity already exists — possible clone",
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