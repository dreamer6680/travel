"use client"

import type React from "react"
import { useState, useEffect } from "react"
import AppSidebar from "@/components/app-sidebar"
import AppHeader from "@/components/app-header"
import { cn } from "@/lib/utils"
import { useUserStore } from "@/lib/store/user-store"
import { usePathname } from "next/navigation"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { checkAuth } = useUserStore()
  const pathname = usePathname()
  const isChat = pathname === "/chat"

  // 初次加载时检查登录态
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Desktop Sidebar ── */}
      <div className="hidden md:block">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </div>

      {/* ── Mobile Sidebar overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50">
            <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AppHeader onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className={cn("flex-1", isChat ? "overflow-hidden flex flex-col" : "overflow-y-auto")}>
          {isChat ? children : (
            <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
          )}
        </main>
      </div>
    </div>
  )
}
