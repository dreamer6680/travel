"use client"

import React from "react"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Menu, X, User, LogIn, MessageCircle } from "lucide-react"
import { ModeToggle } from "./mode-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUserStore } from "@/lib/store/user-store"

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { user, isAuthenticated, checkAuth, logout } = useUserStore()

  // 组件挂载时检查登录状态
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <header className="border-b sticky top-0 z-40 bg-background">
      <div className="w-full flex items-center justify-between h-16 px-4 md:px-6">
        <Link href="/" className="font-bold text-xl">
          旅行规划
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link href="/recommendations" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>探索景点</NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href="/blogs" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>游记分享</NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href="/trip/create" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>行程规划</NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href="/chat" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    AI 助手
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="flex items-center gap-4">
            <ModeToggle />
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">个人设置</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/trips">我的行程</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/chat">AI 助手</Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">后台管理</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>退出登录</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild>
                <Link href="/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  登录
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center gap-4">
          <ModeToggle />
          <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t p-4 space-y-4 bg-background">
          <Link href="/trip/create" className="block py-2 hover:text-primary" onClick={() => setIsMenuOpen(false)}>
            创建行程
          </Link>
          <Link href="/recommendations" className="block py-2 hover:text-primary" onClick={() => setIsMenuOpen(false)}>
            推荐景点
          </Link>
          <Link href="/trips" className="block py-2 hover:text-primary" onClick={() => setIsMenuOpen(false)}>
            我的行程
          </Link>
          <Link href="/chat" className="block py-2 hover:text-primary" onClick={() => setIsMenuOpen(false)}>
            AI 助手
          </Link>
          <Link href="/blogs" className="block py-2 hover:text-primary" onClick={() => setIsMenuOpen(false)}>
            游记分享
          </Link>
          <Link href="/admin" className="block py-2 hover:text-primary" onClick={() => setIsMenuOpen(false)}>
            后台管理
          </Link>
          <div className="pt-4 border-t flex flex-col gap-2">
            {isAuthenticated && user ? (
              <>
                <div className="px-2 py-1.5 mb-2">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/profile">
                    <User className="h-4 w-4 mr-2" />
                    个人中心
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" onClick={logout}>
                  退出登录
                </Button>
              </>
            ) : (
              <Button asChild className="w-full">
                <Link href="/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  登录
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

const ListItem = React.forwardRef<React.ElementRef<"a">, React.ComponentPropsWithoutRef<"a">>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <li>
        <NavigationMenuLink asChild>
          <a
            ref={ref}
            className={cn(
              "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
              className,
            )}
            {...props}
          >
            <div className="text-sm font-medium leading-none">{title}</div>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{children}</p>
          </a>
        </NavigationMenuLink>
      </li>
    )
  },
)
ListItem.displayName = "ListItem"
