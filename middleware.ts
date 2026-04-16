import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// 无需登录即可访问的路径（精确匹配 或 前缀匹配）
const PUBLIC_PATHS = ["/", "/recommendations", "/login"]
const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/favicon.ico", "/public/"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 静态资源和 API 鉴权路由直接放行
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // 公开页面放行
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // 检查 auth-token cookie
  const token = request.cookies.get("auth-token")?.value

  if (!token) {
    const loginUrl = new URL("/login", request.url)
    // 记录原始路径，登录后可跳回
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // 排除 Next.js 内部路由和静态文件
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
