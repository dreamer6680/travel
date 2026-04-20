"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import AppSidebar from "@/components/app-sidebar"
import AppHeader from "@/components/app-header"
import { cn } from "@/lib/utils"
import { useUserStore } from "@/lib/store/user-store"
import { usePathname, useRouter } from "next/navigation"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  /** lg+：整栏显示/隐藏（无窄栏） */
  const [wideSidebarHidden, setWideSidebarHidden] = useState(false)
  /** md～lg：窄栏 / 全宽 */
  const [mediumCollapsed, setMediumCollapsed] = useState(false)
  const [isLg, setIsLg] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  const { checkAuth } = useUserStore()
  const pathname = usePathname()
  const isChat = pathname === "/chat"

  // 初次加载时检查登录态
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // 路由变化时收起移动端侧边栏
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => setIsLg(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  /** 抽屉已开 → 回首页并关抽屉；未开 → 只开抽屉 */
  const handleMobileLogo = useCallback(() => {
    if (mobileOpen) {
      router.push("/")
      setMobileOpen(false)
    } else {
      setMobileOpen(true)
    }
  }, [mobileOpen, router])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Desktop Sidebar：md～1023 可窄栏；lg+ 仅整栏显隐 ── */}
      <div
        className={cn(
          "hidden shrink-0 md:block",
          wideSidebarHidden && "lg:hidden"
        )}
      >
        <AppSidebar
          enableNarrowRail={!isLg}
          collapsed={mediumCollapsed}
          onExpand={() => setMediumCollapsed(false)}
        />
      </div>

      {/* ── Mobile Sidebar overlay（入场 / 退场动效） ── */}
      <AnimatePresence>
        {mobileOpen && (
          <div
            key="mobile-sidebar-root"
            className="fixed inset-0 z-40 md:hidden"
          >
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-0 z-50 h-full shadow-2xl"
              initial={{ x: "-104%" }}
              animate={{ x: 0 }}
              exit={{ x: "-104%" }}
              transition={{
                type: "spring",
                stiffness: 380,
                damping: 34,
                mass: 0.82,
              }}
            >
              <AppSidebar
                onItemClick={() => setMobileOpen(false)}
                onLogoClick={handleMobileLogo}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main（点击侧栏以外：中屏收成窄栏，大屏收起整栏） ── */}
      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        onPointerDownCapture={() => {
          if (typeof window === "undefined") return
          const w = window.innerWidth
          if (w < 768) return
          if (w < 1024) setMediumCollapsed(true)
          else setWideSidebarHidden(true)
        }}
      >
        <AppHeader
          onMenuClick={() => setMobileOpen((v) => !v)}
          onMobileBrandClick={handleMobileLogo}
          showDesktopSidebarTrigger={isLg && wideSidebarHidden}
          onDesktopSidebarOpen={() => setWideSidebarHidden(false)}
        />
        <main className={cn("flex-1", isChat ? "overflow-hidden flex flex-col" : "overflow-y-auto")}>
          {isChat ? children : (
            <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
          )}
        </main>
      </div>
    </div>
  )
}
