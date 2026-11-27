// Placeholder shown while a page's data loads, so a click in the navigation
// gets an immediate response instead of a frozen screen.
export function PageSkeleton({ className = "" }: { className?: string }) {
  const block = "rounded-xl bg-gray-200/70 dark:bg-gray-800/60"
  return (
    <div data-loading className={`animate-pulse space-y-6 ${className}`} role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-72 max-w-full rounded-md bg-gray-200/80 dark:bg-gray-800/70" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`h-24 ${block}`} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className={`h-72 lg:col-span-3 ${block}`} />
        <div className={`h-72 lg:col-span-2 ${block}`} />
      </div>
    </div>
  )
}
