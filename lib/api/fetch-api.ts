// API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"

/**
 * 获取存储的 Token
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("token")
}

/**
 * 设置 Token
 */
export function setToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem("token", token)
}

/**
 * 移除 Token
 */
export function removeToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem("token")
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

