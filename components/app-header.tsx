"use client"

import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useUserStore } from "@/lib/store/user-store"
import Link from "next/link"

// 路径 → 页面标题映射
const PAGE_TITLES: Record<string, string> = {
  "/trips": "我的行程",
  "/chat": "AI 助手",
  "/recommendations": "探索景点",
  "/blogs": "游记广场",
  "/my-blogs": "我的游记",
  "/preferences": "偏好设置",
  "/profile": "个人中心",
  "/admin": "后台管理",
  "/trip/create": "创建行程",
  "/trip/detail": "行程详情",
  "/trip/result": "行程结果",
}

interface AppHeaderProps {
  onMenuClick: () => void
}

export default function AppHeader({ onMenuClick }: AppHeaderProps) {
  const pathname = usePathname()
  const { user, logout } = useUserStore()

  // 获取当前页面标题（精确匹配或前缀匹配）
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key + "/"))?.[1] ??
    "旅行规划"

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 flex-shrink-0">
      {/* mobile / collapse trigger */}
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* page title */}
      <h1 className="flex-1 text-base font-semibold text-foreground">{title}</h1>

      {/* actions */}
      <div className="flex items-center gap-2">
        <ModeToggle />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">个人中心</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/preferences">偏好设置</Link>
              </DropdownMenuItem>
              {user.role === "admin" && (
                <DropdownMenuItem asChild>
                  <Link href="/admin">后台管理</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={logout}
              >
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
