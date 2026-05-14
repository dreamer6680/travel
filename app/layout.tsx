import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import LocatorRuntimeLoader from "@/components/locator-runtime-loader"
import { AuthCookieSync } from "@/components/auth-cookie-sync"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "旅行规划",
  description: "AI 驱动的个性化旅行规划平台",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className={inter.className}>
        {process.env.NODE_ENV === "development" ? <LocatorRuntimeLoader /> : null}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthCookieSync />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
