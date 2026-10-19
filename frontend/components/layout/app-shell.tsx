"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { ThemeToggle } from "@/components/layout/theme-toggle"
import { isNavItemActive, navItems } from "@/lib/nav"
import { cn } from "@/lib/utils"

/**
 * 全站顶栏和内容区。
 * 外壳占满窗口高度。顶栏不滚动，内容区占满剩余高度；页面更高时只在内容区里滚动。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <header className="z-20 shrink-0 border-b border-border bg-background/90 backdrop-blur">
        <nav className="flex flex-wrap items-center gap-1 px-4 py-2.5">
          <Link href="/" className="mr-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <img src="/icon.svg" alt="" className="size-6 shrink-0" />
            DevFlow
          </Link>
          {navItems.map((item) => {
            const active = isNavItemActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-teal-50 font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                    : "text-muted-foreground hover:bg-teal-50 hover:text-teal-800 dark:hover:bg-teal-950 dark:hover:text-teal-200"
                )}
              >
                {item.label}
              </Link>
            )
          })}
          <ThemeToggle />
        </nav>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-auto p-4">{children}</main>
    </div>
  )
}
