"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * 全站主题容器。
 * 用 html 上的 class 切换明暗，默认跟随系统，页面刷新后仍保留用户上次的选择。
 */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
