"use client"

import { useEffect } from "react"
import { getToken, syncAuthCookie } from "@/lib/api/fetch-api"

/**
 * 若仅有 localStorage token、无 Cookie，middleware 会把受保护页重定向到登录。
 * 在任意页面挂载后尝试同步一次；若在 /login 且带 ?redirect=，同步成功后跳回原路径。
 */
export function AuthCookieSync() {
  useEffect(() => {
    const token = getToken()
    if (!token) return

    syncAuthCookie(token)
      .then((ok) => {
        if (!ok) return
        if (typeof window === "undefined") return
        if (window.location.pathname !== "/login") return
        const raw = new URLSearchParams(window.location.search).get("redirect")
        if (raw?.startsWith("/") && !raw.startsWith("//")) {
          window.location.assign(raw)
        }
      })
      .catch(() => {})
  }, [])

  return null
}
