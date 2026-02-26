import { NextResponse } from "next/server"
import { AuthService } from "@/server/controllers/auth.service"

const authService = new AuthService()

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    // 数据校验
    if (!email || !password) {
      return NextResponse.json(
        { error: "邮箱和密码不能为空" },
        { status: 400 }
      )
    }

    // 调用业务逻辑
    const result = await authService.login(email, password)

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 401 }
      )
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("登录失败:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "登录失败",
        message: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 500 }
    )
  }
}
