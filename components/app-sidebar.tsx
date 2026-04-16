"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
  ChevronLeft,
  Plane,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  collapsed: boolean
  onToggle: () => void
}

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useUserStore()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out flex-shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* ── Logo ── */}
        <div className={cn("flex items-center h-14 px-3 border-b border-sidebar-border", collapsed ? "justify-center" : "gap-3")}>
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Plane className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-sidebar-foreground text-sm tracking-wide truncate">
              旅行规划
            </span>
          )}
        </div>

        {/* ── Main nav ── */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {NAV_MAIN.map(({ href, label, icon: Icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={isActive(href)}
              collapsed={collapsed}
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
              collapsed={collapsed}
            />
          ))}

          {user?.role === "admin" && (
            <NavItem
              href="/admin"
              label="后台管理"
              icon={ShieldCheck}
              active={isActive("/admin")}
              collapsed={collapsed}
            />
          )}
        </nav>

        {/* ── User area ── */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          {user ? (
            <>
              {!collapsed && (
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-sidebar-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
              )}
              <NavItem
                href="#"
                label="退出登录"
                icon={LogOut}
                active={false}
                collapsed={collapsed}
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
              collapsed={collapsed}
            />
          )}
        </div>

        {/* ── Collapse toggle ── */}
        <button
          onClick={onToggle}
          className={cn(
            "absolute -right-3 top-[3.25rem] z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted transition-colors",
            "text-muted-foreground hover:text-foreground"
          )}
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          <ChevronLeft className={cn("h-3 w-3 transition-transform duration-300", collapsed && "rotate-180")} />
        </button>
      </aside>
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
  onClick,
  variant = "default",
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  collapsed: boolean
  onClick?: () => void
  variant?: "default" | "ghost-danger"
}) {
  const baseClass = cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors w-full",
    collapsed && "justify-center px-2",
    variant === "ghost-danger"
      ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      : active
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  )

  const content = (
    <>
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  )

  const element = onClick ? (
    <button className={baseClass} onClick={onClick}>
      {content}
    </button>
  ) : (
    <Link href={href} className={baseClass}>
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
