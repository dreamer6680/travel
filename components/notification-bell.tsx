"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Bell, Check, CheckCheck, MessageCircle, FileCheck, MapPin, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { notificationAPI } from "@/lib/api"
import type { Notification } from "@/lib/api-client/notification-service"
import Link from "next/link"
import { useRouter } from "next/navigation"

const TYPE_ICON: Record<string, React.ReactNode> = {
  comment_reply: <MessageCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />,
  blog_approved: <FileCheck className="h-4 w-4 text-green-500 flex-shrink-0" />,
  blog_rejected: <FileCheck className="h-4 w-4 text-red-500 flex-shrink-0" />,
  trip_complete: <MapPin className="h-4 w-4 text-purple-500 flex-shrink-0" />,
}

const POLL_INTERVAL = 30_000 // 30s

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationAPI.getNotifications()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // 静默失败，不影响主流程
    }
  }, [])

  // 初次加载 + 定时轮询
  useEffect(() => {
    fetchNotifications()
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchNotifications])

  // 打开面板时立即刷新
  const handleOpenChange = (o: boolean) => {
    setOpen(o)
    if (o) fetchNotifications()
  }

  const handleMarkAllRead = async () => {
    setLoading(true)
    try {
      await notificationAPI.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }

  const handleClickNotification = async (n: Notification) => {
    if (!n.read) {
      notificationAPI.markAsRead(n.id).catch(() => {})
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "刚刚"
    if (mins < 60) return `${mins}分钟前`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}小时前`
    const days = Math.floor(hrs / 24)
    return `${days}天前`
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="通知">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold text-sm">
            通知
            {unreadCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">({unreadCount} 未读)</span>
            )}
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleMarkAllRead}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              全部已读
            </Button>
          )}
        </div>

        <Separator />

        {/* List */}
        <ScrollArea className="h-[360px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">暂无通知</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors",
                    !n.read && "bg-blue-50/60 dark:bg-blue-950/20"
                  )}
                >
                  <div className="mt-0.5">
                    {TYPE_ICON[n.type] ?? <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-snug", !n.read && "font-medium")}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatTime(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
