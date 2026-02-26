import { NextResponse } from "next/server"
import { UserService } from "@/server/controllers"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

const userService = new UserService()

export async function GET(request: Request) {
  try {
    // 验证用户身份
    const authResult = await authenticateRequest(request as any)

    if (!authResult.authenticated) {
      return authResult.response
    }

    // 从 token 中获取用户 ID
    const userId = authResult.user?.id || authResult.payload?.userId

    if (!userId) {
      return NextResponse.json(
        { error: "无法获取用户信息" },
        { status: 401 }
      )
    }

    const userProfile = await userService.getUserProfile(userId)
    return NextResponse.json(userProfile)
  } catch (error) {
    console.error("获取用户信息失败:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    // 验证用户身份
    const authResult = await authenticateRequest(request as any)

    if (!authResult.authenticated) {
      return authResult.response
    }

    const userData = await request.json()
    const userId = authResult.user?.id || authResult.payload?.userId

    if (!userId) {
      return NextResponse.json(
        { error: "无法获取用户信息" },
        { status: 401 }
      )
    }

    const result = await userService.updateUserProfile(userId, userData)
    return NextResponse.json(result)
  } catch (error) {
    console.error("更新用户信息失败:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "更新用户信息失败",
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
