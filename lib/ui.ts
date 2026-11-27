// Shared class names for form controls and buttons, so every screen uses the
// same sizes, focus states and colours.

export const fieldLabel =
  "text-sm font-medium text-gray-800 dark:text-gray-200"

export const fieldHint = "text-xs text-gray-500 dark:text-gray-400"

export const inputBase =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-xs outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:ring-3 focus:ring-brand-600/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-brand-400 dark:focus:ring-brand-400/20"

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"

export const buttonPrimary = `${buttonBase} bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-gray-950 dark:hover:bg-brand-400`

export const buttonSecondary = `${buttonBase} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800`

export const buttonGhost = `${buttonBase} text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white`

export const card =
  "rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"

export const cardHeader =
  "flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800"

export const cardTitle = "text-sm font-semibold text-gray-900 dark:text-white"

export const tableHead =
  "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
