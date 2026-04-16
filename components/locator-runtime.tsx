"use client"

import { useEffect } from "react"

/**
 * LocatorJS Option B：仅在浏览器端动态加载 @locator/runtime。
 * 勿在服务端 import 该包（会与 React 调度器冲突）。
 * @see https://www.locatorjs.com/install/react
 */
export default function LocatorRuntime() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return

    let cancelled = false
    void import("@locator/runtime")
      .then((mod) => {
        if (cancelled) return
        const setup = mod.default
        if (typeof setup === "function") setup()
      })
      .catch(() => {
        // 静默失败，避免打断开发
      })

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
