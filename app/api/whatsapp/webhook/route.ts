import { NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"
import { verifyBottle } from "@/lib/verify"
import {
  sendMessage,
  buildGenuineMessage,
  buildWarningMessage,
  buildFlaggedMessage,
  buildNotFoundMessage,
} from "@/lib/whatsapp"
import crypto from "crypto"

// Meta sends a GET request to verify the webhook
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

// Meta sends a POST request for every incoming message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages

    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: "no_message" }, { status: 200 })
    }

    const message = messages[0]
    const from = message.from // sender's phone number
    const messageType = message.type

    let rawText = ""

    if (messageType === "text") {
      rawText = message.text?.body?.trim() ?? ""
    } else {
      await sendMessage(
        from,
        "Please send the serial code printed under your bottle cap, or scan the QR code with your camera."
      )
      return NextResponse.json({ status: "unsupported_type" }, { status: 200 })
    }

    // Extract serial ID — strip dashes and whitespace, uppercase
    const serialId = rawText.replace(/[-\s]/g, "").toUpperCase()

    if (serialId.length < 8) {
      await sendMessage(
        from,
        "That doesn't look like a valid code. Please scan the QR code under your bottle cap or type the serial number exactly as printed."
      )
      return NextResponse.json({ status: "invalid_input" }, { status: 200 })
    }

    // Hash the phone number for privacy
    const phoneHash = crypto
      .createHash("sha256")
      .update(from)
      .digest("hex")

    const result = await verifyBottle({ serialId, phoneHash })

    let replyText = ""

    if (result.status === "GENUINE") {
      replyText = buildGenuineMessage(
        result.message.split(".")[0].replace("Genuine ", ""),
        serialId
      )
    } else if (result.status === "WARNING") {
      replyText = buildWarningMessage(
        result.firstScan,
        result.firstLocation,
        serialId
      )
    } else if (result.status === "FLAGGED") {
      replyText = buildFlaggedMessage(
        result.message,
        serialId
      )
    } else {
      replyText = buildNotFoundMessage(serialId)
    }

    await sendMessage(from, replyText)

    return NextResponse.json({ status: "ok" }, { status: 200 })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ status: "error" }, { status: 200 })
  }
}