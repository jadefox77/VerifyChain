import { env } from "@/lib/env"

const API_URL = `https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_ID}/messages`

async function sendMessage(to: string, text: string): Promise<void> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    console.error("WhatsApp send error:", error)
  }
}

export function buildGenuineMessage(productName: string, serialId: string): string {
  return [
    "✅ *GENUINE PRODUCT*",
    "",
    `Product: ${productName}`,
    `Serial: ${serialId}`,
    "",
    "This bottle has just been opened for the first time.",
    "It is safe to consume.",
    "",
    "_Verified by VerifyChain Africa_",
  ].join("\n")
}

export function buildWarningMessage(
  firstScannedAt: Date,
  firstLocation: string | null,
  serialId: string
): string {
  const time = firstScannedAt.toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return [
    "⚠️ *ALREADY OPENED*",
    "",
    "This bottle was previously opened.",
    `First scanned: ${time}`,
    firstLocation ? `First location: ${firstLocation}` : null,
    `Serial: ${serialId}`,
    "",
    "Possible refill or reuse detected.",
    "Exercise caution.",
    "",
    "_Verified by VerifyChain Africa_",
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildFlaggedMessage(
  reason: string,
  serialId: string
): string {
  return [
    "🚨 *FRAUD ALERT*",
    "",
    "This product has been flagged for fraud.",
    `Reason: ${reason}`,
    `Serial: ${serialId}`,
    "",
    "Do not consume this product.",
    "Please report to your supplier.",
    "",
    "_Verified by VerifyChain Africa_",
  ].join("\n")
}

export function buildNotFoundMessage(serialId: string): string {
  return [
    "❌ *NOT FOUND*",
    "",
    "This code was not found in our system.",
    `Code: ${serialId}`,
    "",
    "This product may be counterfeit.",
    "Do not consume.",
    "",
    "_Verified by VerifyChain Africa_",
  ].join("\n")
}

export { sendMessage }