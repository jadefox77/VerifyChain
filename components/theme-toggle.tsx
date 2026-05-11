"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {[
        { value: "light", icon: "☀️", label: "Light" },
        { value: "system", icon: "💻", label: "System" },
        { value: "dark", icon: "🌙", label: "Dark" },
      ].map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          title={option.label}
          className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
            theme === option.value
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          {option.icon}
        </button>
      ))}
    </div>
  )
}