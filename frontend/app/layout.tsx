import type { Metadata } from "next"
import { Geist, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { AppShell } from "@/components/layout/app-shell"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

/** 浏览器标题。各模块页暂不单独覆盖。 */
export const metadata: Metadata = {
  title: "DevFlow",
  description: "面向仓库协作的研发工作台",
}

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn("h-full antialiased", fontSans.variable, "font-mono", jetbrainsMono.variable)}
    >
      <body className="flex h-full min-h-full flex-col">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
