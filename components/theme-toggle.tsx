"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"

const OPTIONS = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "system", label: "Match device theme", icon: Monitor },
  { value: "dark", label: "Dark theme", icon: Moon },
] as const

const subscribe = () => () => {}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  // The stored theme is only known in the browser, so render a neutral
  // placeholder on the server to avoid a hydration mismatch.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800 ${className}`}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              active
                ? "bg-white text-gray-900 shadow-xs dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
