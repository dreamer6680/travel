import { NextResponse } from "next/server"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

/**
 * 验证 Token 有效性
 */
export async function GET(request: Request) {
  try {
    const authResult = await authenticateRequest(request as any)

    if (!authResult.authenticated) {
      return authResult.response
    }

    return NextResponse.json({
      success: true,
      user: authResult.user,
    })
  } catch (error) {
    console.error("Token 验证失败:", error)
    return NextResponse.json(
      { error: "Token 验证失败" },
      { status: 500 }
    )
  }
}
