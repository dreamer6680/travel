/**
 * 客户端认证工具函数
 */

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

/**
 * 检查用户是否已登录
 */
export function isAuthenticated(): boolean {
  return getToken() !== null
}

/**
 * 登出
 */
export function logout(): void {
  removeToken()
  if (typeof window !== "undefined") {
    window.location.href = "/login"
  }
}
