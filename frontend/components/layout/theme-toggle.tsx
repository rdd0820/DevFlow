"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

/**
 * 顶栏右侧的明暗切换。
 * 挂载前不读取当前主题，避免服务端渲染和浏览器对系统主题的判断不一致。
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  /** 是否已经在浏览器里挂载。未挂载时按钮只占位，不显示具体图标。 */
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  /** 当前实际生效的是深色。未挂载时按浅色处理，避免图标先闪一下。 */
  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "切换为浅色" : "切换为深色"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="ml-auto text-slate-600 dark:text-slate-300"
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
