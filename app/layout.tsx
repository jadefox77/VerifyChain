import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "VerifyChain Africa | Product authentication for manufacturers",
    template: "%s | VerifyChain Africa",
  },
  description:
    "VerifyChain Africa gives every bottle and pack a unique, signed QR identity. Shoppers check a product in their phone browser in seconds, and manufacturers see where fakes and refills turn up.",
  applicationName: "VerifyChain Africa",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexMono.variable} font-sans antialiased bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100`}
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
