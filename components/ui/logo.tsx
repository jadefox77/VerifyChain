import { cn } from "@/lib/utils"

// The mark is a sealed tile with a check stroke that doubles as a V.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("h-8 w-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-brand-600" />
      <path
        d="M8.5 15.5 14 21.5 23.5 10"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({
  className,
  markClassName,
  label,
  compact = false,
}: {
  className?: string
  markClassName?: string
  /** Small caption under the wordmark, e.g. "Admin" */
  label?: string
  /** Show "VerifyChain" without "Africa" */
  compact?: boolean
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-white">
          VerifyChain
          {!compact && (
            <span className="font-normal text-gray-500 dark:text-gray-400"> Africa</span>
          )}
        </span>
        {label && (
          <span className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {label}
          </span>
        )}
      </span>
    </span>
  )
}
