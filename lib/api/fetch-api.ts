// 浏览器请求的 BFF 前缀：默认与当前站点同源（/api → Next 的 app/api），Docker 任意端口都可用。
// 仅当前端与 API 不同源时再设置 NEXT_PUBLIC_API_URL（须带 /api 后缀）。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api"
const AUTH_COOKIE = "auth-token"
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60

/**
 * 获取存储的 Token
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("token")
}

/**
 * 设置 Token（localStorage + cookie，cookie 供 middleware 鉴权使用）
 */
export function setToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem("token", token)
  // 同步到 cookie，max-age=7d，供 Next.js middleware 读取
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
  document.cookie = `${AUTH_COOKIE}=${token}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`
}

/**
 * 判断 middleware 需要的 Cookie 是否已经存在。
 */
export function hasAuthCookie(): boolean {
  if (typeof window === "undefined") return false
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${AUTH_COOKIE}=`))
}

/**
 * 将 localStorage token 同步成服务端认可的 auth-token Cookie。
 * 登录后跳转受保护页面前必须等待它完成，避免 middleware 看不到 Cookie。
 */
export async function syncAuthCookie(token = getToken()): Promise<boolean> {
  if (typeof window === "undefined" || !token) return false

  setToken(token)

  try {
    const res = await fetch("/api/auth/sync-cookie", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })

    if (res.ok) {
      return hasAuthCookie()
    }

    if (res.status === 401) {
      removeToken()
    }
  } catch {
    return hasAuthCookie()
  }

  return false
}

/**
 * 移除 Token
 */
export function removeToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem("token")
  // 同时清除 cookie
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`
}

// 通用请求函数
export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  
  // 获取 token
  const token = getToken()
  
  // 构建请求头
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  
  // 如果有 token，添加到请求头
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  
  const response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? "same-origin",
    headers,
  })

  // 如果返回 401，清除 token
  if (response.status === 401) {
    removeToken()
    // 可以在这里触发登出逻辑
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || error.error || "请求失败")
  }

  return response.json()
}

