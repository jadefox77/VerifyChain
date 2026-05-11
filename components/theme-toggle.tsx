"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return (
    <div className="h-8 w-28 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
  )

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-0.5">
      {[
        { value: "light", icon: "☀️" },
        { value: "system", icon: "💻" },
        { value: "dark", icon: "🌙" },
      ].map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          title={option.value}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
            theme === option.value
              ? "bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {option.icon}
        </button>
      ))}
    </div>
  )
}