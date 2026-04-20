"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  MapPin,
  MessageCircle,
  Compass,
  BookOpen,
  BookMarked,
  Settings2,
  User,
  ShieldCheck,
  LogOut,
  LogIn,
  Plane,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useUserStore } from "@/lib/store/user-store"

import { Separator } from "@/components/ui/separator"
const NAV_MAIN = [
  { href: "/trips", label: "我的行程", icon: MapPin },
  { href: "/chat", label: "AI 助手", icon: MessageCircle },
  { href: "/recommendations", label: "探索景点", icon: Compass },
  { href: "/blogs", label: "游记广场", icon: BookOpen },
  { href: "/my-blogs", label: "我的游记", icon: BookMarked },
]

const NAV_SECONDARY = [
  { href: "/preferences", label: "偏好设置", icon: Settings2 },
  { href: "/profile", label: "个人中心", icon: User },
]

interface AppSidebarProps {
  /**
   * 桌面 md～lg：允许 w-16 窄栏；lg+ 宽度够时始终全宽 w-60（由外层隐藏整栏，无窄栏）
   */
  enableNarrowRail?: boolean
  /** 仅在 enableNarrowRail 时生效：true 为窄栏仅图标 */
  collapsed?: boolean
  /** 窄栏时点击侧栏内区域展开 */
  onExpand?: () => void
  /** 移动端抽屉：点击菜单项后收起 */
  onItemClick?: () => void
  /**
   * 移动端：由 layout 根据「抽屉是否已打开」决定回首页或仅开抽屉；
   * 未传入时桌面点击 Logo 仍为 router.push("/")
   */
  onLogoClick?: () => void
}

export default function AppSidebar({
  enableNarrowRail = false,
  collapsed = false,
  onExpand,
  onItemClick,
  onLogoClick,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useUserStore()
  const router = useRouter()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  const narrow = enableNarrowRail && collapsed

  const sidebarTransition = {
    type: "spring" as const,
    stiffness: 420,
    damping: 36,
    mass: 0.85,
  }

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: narrow ? 64 : 240 }}
        transition={sidebarTransition}
        onPointerDown={() => {
          if (narrow) onExpand?.()
        }}
        className={cn(
          "relative flex h-screen flex-shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar"
        )}
      >
        {/* ── Logo ── */}
        <button
          type="button"
          onClick={() => {
            if (onLogoClick) {
              onLogoClick()
              return
            }
            router.push("/")
          }}
          className={cn(
            "flex h-14 items-center border-b border-sidebar-border px-3",
            narrow ? "justify-center" : "gap-3"
          )}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <Plane className="h-4 w-4 text-white" />
          </div>
          {!narrow && (
            <span className="truncate text-sm font-bold tracking-wide text-sidebar-foreground">旅行规划</span>
          )}
        </button>

        {/* ── Main nav ── */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {NAV_MAIN.map(({ href, label, icon: Icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={isActive(href)}
              collapsed={narrow}
              onItemClick={onItemClick}
            />
          ))}

          <div className="py-2">
            <Separator className="bg-sidebar-border" />
          </div>

          {NAV_SECONDARY.map(({ href, label, icon: Icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={isActive(href)}
              collapsed={narrow}
              onItemClick={onItemClick}
            />
          ))}

          {user?.role === "admin" && (
            <NavItem
              href="/admin"
              label="后台管理"
              icon={ShieldCheck}
              active={isActive("/admin")}
              collapsed={narrow}
              onItemClick={onItemClick}
            />
          )}
        </nav>

        {/* ── User area ── */}
        <div className="space-y-1 border-t border-sidebar-border p-2">
          {user ? (
            <>
              {!narrow && (
                <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-sidebar-foreground">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              )}
              <NavItem
                href="#"
                label="退出登录"
                icon={LogOut}
                active={false}
                collapsed={narrow}
                onItemClick={onItemClick}
                onClick={logout}
                variant="ghost-danger"
              />
            </>
          ) : (
            <NavItem
              href="/login"
              label="登录 / 注册"
              icon={LogIn}
              active={false}
              collapsed={narrow}
              onItemClick={onItemClick}
            />
          )}
        </div>
      </motion.aside>
    </TooltipProvider>
  )
}

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onItemClick,
  onClick,
  variant = "default",
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  collapsed: boolean
  onItemClick?: () => void
  onClick?: () => void
  variant?: "default" | "ghost-danger"
}) {
  const baseClass = cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
    collapsed && "justify-center px-2",
    variant === "ghost-danger"
      ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      : active
        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  )

  const content = (
    <>
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  )

  const element = onClick ? (
    <button
      type="button"
      className={baseClass}
      onClick={() => {
        onItemClick?.()
        onClick()
      }}
    >
      {content}
    </button>
  ) : (
    <Link
      href={href}
      className={baseClass}
      onClick={() => {
        onItemClick?.()
      }}
    >
      {content}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{element}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return element
}
