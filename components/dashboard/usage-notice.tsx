import Link from "next/link"
import { TriangleAlert } from "lucide-react"
import type { MonthlyUsage } from "@/lib/plans"
import { formatDate } from "@/lib/format"

const SUPPORT = "support@verifychain.africa"

// Warns a manufacturer when they are close to, or past, this month's allowance.
// Renders nothing while usage is comfortably inside the limit.
export function UsageNotice({ usage, showPlanLink = true }: { usage: MonthlyUsage; showPlanLink?: boolean }) {
  if (usage.state === "ok") return null

  const over = usage.state === "over"
  const resets = formatDate(usage.resetsOn)
  const tone = over
    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
  const icon = over ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"

  return (
    <div role={over ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border p-4 ${tone}`}>
      <TriangleAlert className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} aria-hidden="true" />
      <div className="text-sm">
        <p className="font-semibold">
          {over ? "You have used this month's allowance" : "You are close to this month's allowance"}
        </p>
        <p className="mt-0.5">
          {over
            ? `${usage.used.toLocaleString()} of ${usage.limit.toLocaleString()} units serialised. New batches are paused until ${resets}, or until you move to a larger plan.`
            : `${usage.used.toLocaleString()} of ${usage.limit.toLocaleString()} units serialised, ${usage.remaining.toLocaleString()} left. Once you reach the limit, new batches are paused until ${resets}.`}{" "}
          To change your plan, email{" "}
          <a href={`mailto:${SUPPORT}`} className="font-medium underline underline-offset-2">
            {SUPPORT}
          </a>
          .
        </p>
        {showPlanLink && (
          <p className="mt-2">
            <Link href="/dashboard/billing" className="font-medium underline underline-offset-2">
              See plan and usage
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
