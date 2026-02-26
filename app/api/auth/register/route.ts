import { NextResponse } from "next/server"
import { AuthService } from "@/server/controllers/authService"

const authService = new AuthService()

export async function POST(request: Request) {
  try {
    const userData = await request.json()

    // 调用业务逻辑
    const result = await authService.register(userData)

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("注册失败:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "注册失败",
        message: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 500 }
    )
  }
}
