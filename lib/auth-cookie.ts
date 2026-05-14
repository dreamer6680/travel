import type { NextResponse } from "next/server"

const AUTH_COOKIE = "auth-token"
const MAX_AGE_SEC = 7 * 24 * 60 * 60

/**
 * 在 Route Handler 响应上追加 auth-token Cookie，与客户端 setToken 语义一致，
 * 供 middleware 与 authenticateRequest（读 Cookie）使用。HTTPS 时加 Secure。
 */
export function appendAuthTokenSetCookie(
  response: NextResponse,
  request: Request,
  token: string
): void {
  const forwarded = request.headers.get("x-forwarded-proto")
  let secure = forwarded === "https"
  try {
    const url = new URL(request.url)
    if (url.protocol === "https:") secure = true
  } catch {
    /* ignore */
  }
  const parts = [
    `${AUTH_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SEC}`,
    "SameSite=Lax",
  ]
  if (secure) parts.push("Secure")
  response.headers.append("Set-Cookie", parts.join("; "))
}
