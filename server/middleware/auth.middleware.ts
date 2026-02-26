import { NextRequest, NextResponse } from "next/server"
import { extractTokenFromHeader, verifyToken } from "@/lib/jwt"
import { AuthService } from "@/server/controllers/auth.service"

const authService = new AuthService()

/**
 * 认证中间件 - 验证请求中的 JWT Token
 */
export async function authenticateRequest(request: NextRequest) {
  try {
    // 从请求头获取 token
    const authHeader = request.headers.get("authorization")
    const token = extractTokenFromHeader(authHeader)

    if (!token) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: "未提供认证 Token" },
          { status: 401 }
        ),
      }
    }

    // 验证 token
    const payload = verifyToken(token)

    if (!payload) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: "Token 无效或已过期" },
          { status: 401 }
        ),
      }
    }

    // 从数据库获取用户信息（可选，用于验证用户是否仍然存在）
    const result = await authService.verifyTokenAndGetUser(token)

    if (!result.success) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: result.message || "用户验证失败" },
          { status: 401 }
        ),
      }
    }

    return {
      authenticated: true,
      user: result.user,
      payload,
    }
  } catch (error) {
    console.error("认证中间件错误:", error)
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "认证失败" },
        { status: 500 }
      ),
    }
  }
}

/**
 * 检查用户角色
 */
export function checkRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole)
}
