import { NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"
import { verifyBottle } from "@/lib/verify"
import { verifyCap } from "@/lib/verify-cap"
import {
  sendMessage,
  buildGenuineMessage,
  buildWarningMessage,
  buildFlaggedMessage,
  buildNotFoundMessage,
} from "@/lib/whatsapp"
import crypto from "crypto"

// Store pending bottle scans per phone number
// In production this should be Redis — for MVP an in-memory map works
const pendingBottleScans = new Map<string, string>()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    if (!message) {
      return NextResponse.json({ status: "no_message" }, { status: 200 })
    }

    const from = message.from
    const messageType = message.type

    let userLat: number | undefined
let userLng: number | undefined

if (messageType === "location") {
  // Store location for this phone and ask them to now send the code
  userLat = message.location?.latitude
  userLng = message.location?.longitude
  await sendMessage(
    from,
    "📍 Location received. Now send your bottle serial code or scan the QR code."
  )
  return NextResponse.json({ status: "location_stored" }, { status: 200 })
}

if (messageType !== "text") {
  await sendMessage(
    from,
    "Please send the serial code printed on your bottle or scan the QR code with your camera."
  )
  return NextResponse.json({ status: "unsupported_type" }, { status: 200 })
}

    const rawText = message.text?.body?.trim() ?? ""
    const code = rawText.replace(/[-\s]/g, "").toUpperCase()

    if (code.length < 6) {
      await sendMessage(
        from,
        "That doesn't look like a valid code. Please scan the QR code on the bottle or type the serial number exactly as printed."
      )
      return NextResponse.json({ status: "invalid_input" }, { status: 200 })
    }

    const phoneHash = crypto
      .createHash("sha256")
      .update(from)
      .digest("hex")

    // Check if this phone has a pending bottle scan waiting for cap scan
    const pendingBottleSerial = pendingBottleScans.get(from)

    // Determine if this looks like a hidden cap code (16 chars) or bottle code (12 chars)
    const isCapCode = code.length === 16
    const isBottleCode = code.length === 12

    if (isCapCode || (pendingBottleSerial && !isBottleCode)) {
      // Step 2 — cap verification
      const result = await verifyCap({
        hiddenSerialId: code,
        bottleSerialId: pendingBottleSerial,
        phoneHash,
      })

      pendingBottleScans.delete(from)

      let replyText = ""

      if (result.status === "GENUINE") {
        replyText = buildGenuineMessage(result.productName, code)
      } else if (result.status === "WARNING") {
        replyText = buildWarningMessage(result.firstOpened, result.firstLocation, code)
      } else if (result.status === "MISMATCH") {
        replyText = [
          "🚨 *IDENTITY MISMATCH*",
          "",
          "The cap does not match this bottle.",
          "This bottle may have been refilled.",
          "Do not consume.",
          "",
          "_Verified by VerifyChain Africa_",
        ].join("\n")
      } else if (result.status === "FLAGGED") {
        replyText = buildFlaggedMessage(result.reason, code)
      } else {
        replyText = buildNotFoundMessage(code)
      }

      await sendMessage(from, replyText)
    } else if (isBottleCode) {
      // Step 1 — bottle verification
      const result = await verifyBottle({ serialId: code, phoneHash })

      if (result.status === "PROMPT_CAP") {
        // Store this bottle scan, waiting for cap
        pendingBottleScans.set(from, code)

        await sendMessage(
          from,
          [
            "🔍 *STEP 1 COMPLETE*",
            "",
            `Bottle identity confirmed: *${result.productName}*`,
            "",
            "To complete verification:",
            "1. Open the bottle",
            "2. Look inside the cap for a hidden QR code",
            "3. Scan that QR code or type the code here",
            "",
            result.topCode
              ? `Top-cap reference code: *${result.topCode}*`
              : "",
            "",
            "_VerifyChain Africa_",
          ]
            .filter(Boolean)
            .join("\n")
        )
      } else if (result.status === "ALREADY_OPENED") {
        await sendMessage(
          from,
          [
            "⚠️ *ALREADY OPENED*",
            "",
            "This bottle was previously verified.",
            `First opened: ${new Date(result.firstScan).toLocaleString("en-NG")}`,
            "",
            "Possible reuse or refill detected.",
            "",
            "_VerifyChain Africa_",
          ].join("\n")
        )
      } else if (result.status === "FLAGGED") {
        await sendMessage(from, buildFlaggedMessage("Previously flagged", code))
      } else {
        await sendMessage(from, buildNotFoundMessage(code))
      }
    } else {
  // Unknown length — try cap first, then bottle
  const capResult = await verifyCap({ hiddenSerialId: code, phoneHash })
  if (capResult.status !== "NOT_FOUND") {
    let replyText = ""
    if (capResult.status === "GENUINE") {
      replyText = buildGenuineMessage(capResult.productName, code)
    } else if (capResult.status === "WARNING") {
      replyText = buildWarningMessage(capResult.firstOpened, capResult.firstLocation, code)
    } else if (capResult.status === "FLAGGED") {
      replyText = buildFlaggedMessage(capResult.reason, code)
    } else if (capResult.status === "MISMATCH") {
      replyText = "🚨 Identity mismatch detected. Do not consume."
    }
    await sendMessage(from, replyText)
  } else {
    await sendMessage(
      from,
      "Code not recognised. Please scan the QR code on your bottle or inside the cap."
    )
  }
}

    return NextResponse.json({ status: "ok" }, { status: 200 })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ status: "error" }, { status: 200 })
  }
}