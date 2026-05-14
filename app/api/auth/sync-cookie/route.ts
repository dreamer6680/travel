import { NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { appendAuthTokenSetCookie } from "@/lib/auth-cookie"

/**
 * 将 localStorage 中的 JWT 同步为 Http Cookie（与登录后 middleware 要求一致）。
 * 仅在校验通过时下发 Set-Cookie。
 */
export async function POST(request: Request) {
  let body: { token?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 })
  }

  const token = body.token
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "缺少 token" }, { status: 400 })
  }

  if (!verifyToken(token)) {
    return NextResponse.json({ error: "无效或过期 token" }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  appendAuthTokenSetCookie(res, request, token)
  return res
}
