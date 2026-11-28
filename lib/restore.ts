import type { CapStatus, BottleStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

// Staff "Restore" for products flagged by the cap mismatch or the repeated
// drift rule. Nothing stores the status a product had before it was flagged,
// so it is worked out from what did happen to it:
//   cap:    SEALED if it was never opened, otherwise OPENED
//   bottle: OPENED if its cap was opened, otherwise MINT
// Restoring also resolves the alert (so a cap scanned alone is no longer
// refused, and the batch's drift count starts again) and writes one audit
// log entry with who did it, why, and each product's status before and after.

export const RESTORABLE_ALERT_TYPES = ["INVALID_PAIRING", "SUPPLY_CHAIN_DRIFT"] as const

export const REASON_MIN = 5
export const REASON_MAX = 500

export type RestoreResult =
  | { ok: true; restored: number }
  | { ok: false; error: "not_found" | "wrong_type" | "bad_reason" | "nothing_to_restore" }

type Change = {
  capId: string | null
  bottleSerialId: string
  cap?: { from: CapStatus; to: CapStatus }
  bottle?: { from: BottleStatus; to: BottleStatus }
}

export function parseReason(value: unknown): string | null {
  const reason = String(value ?? "").trim().replace(/\s+/g, " ")
  if (reason.length < REASON_MIN) return null
  return reason.slice(0, REASON_MAX)
}

// The products an alert covers. A mismatch alert is about one cap (its id is
// in the detail). A drift alert is about a batch; only the products that the
// repeated drift rule flagged are restored, not ones flagged for other reasons.
async function capsForAlert(alert: { type: string; detail: string | null; batchId: string | null }) {
  if (alert.type === "INVALID_PAIRING") {
    let capId: string | undefined
    try {
      capId = JSON.parse(alert.detail ?? "{}").capId
    } catch {
      capId = undefined
    }
    if (!capId) return []
    const cap = await prisma.cap.findUnique({
      where: { id: capId },
      select: { id: true, status: true, openedAt: true, bottle: { select: { id: true, serialId: true, status: true } } },
    })
    return cap ? [cap] : []
  }

  if (!alert.batchId) return []
  const logs = await prisma.scanLog.findMany({
    where: { batchId: alert.batchId, scanLayer: "CAP", fraudFlag: true, flagReason: { endsWith: "(repeated drift)" } },
    distinct: ["capId"],
    select: { capId: true },
  })
  const ids = logs.map((l) => l.capId).filter((id): id is string => Boolean(id))
  if (ids.length === 0) return []
  return prisma.cap.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, openedAt: true, bottle: { select: { id: true, serialId: true, status: true } } },
  })
}

export async function restoreFromAlert(alertId: string, staffUserId: string, rawReason: unknown): Promise<RestoreResult> {
  const reason = parseReason(rawReason)
  if (!reason) return { ok: false, error: "bad_reason" }

  const alert = await prisma.alertLog.findUnique({
    where: { id: alertId },
    select: { id: true, type: true, detail: true, batchId: true, resolved: true },
  })
  if (!alert) return { ok: false, error: "not_found" }
  if (!(RESTORABLE_ALERT_TYPES as readonly string[]).includes(alert.type)) return { ok: false, error: "wrong_type" }

  const caps = await capsForAlert(alert)
  const changes: Change[] = []
  for (const cap of caps) {
    if (!cap.bottle) continue
    const change: Change = { capId: cap.id, bottleSerialId: cap.bottle.serialId }
    if (cap.status === "FLAGGED") change.cap = { from: "FLAGGED", to: cap.openedAt ? "OPENED" : "SEALED" }
    if (cap.bottle.status === "FLAGGED") change.bottle = { from: "FLAGGED", to: cap.openedAt ? "OPENED" : "MINT" }
    if (change.cap || change.bottle) changes.push(change)
  }
  if (changes.length === 0 && alert.resolved) return { ok: false, error: "nothing_to_restore" }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    for (const c of changes) {
      // Only rows still FLAGGED are changed, in case a scan moved them since
      if (c.cap && c.capId) {
        await tx.cap.updateMany({ where: { id: c.capId, status: "FLAGGED" }, data: { status: c.cap.to } })
      }
      if (c.bottle) {
        await tx.bottle.updateMany({ where: { serialId: c.bottleSerialId, status: "FLAGGED" }, data: { status: c.bottle.to } })
      }
    }
    await tx.alertLog.updateMany({
      where: { id: alert.id, resolved: false },
      data: { resolved: true, resolvedAt: now, resolvedBy: staffUserId },
    })
    await tx.auditLog.create({
      data: {
        userId: staffUserId,
        action: "PRODUCTS_RESTORED",
        targetType: "AlertLog",
        targetId: alert.id,
        before: JSON.stringify({
          alertResolved: alert.resolved,
          products: changes.map((c) => ({ bottle: c.bottleSerialId, cap: c.cap?.from, bottleStatus: c.bottle?.from })),
        }),
        after: JSON.stringify({
          reason,
          alertResolved: true,
          products: changes.map((c) => ({ bottle: c.bottleSerialId, cap: c.cap?.to, bottleStatus: c.bottle?.to })),
        }),
      },
    })
  })
  return { ok: true, restored: changes.length }
}
