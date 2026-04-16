import { NextResponse } from "next/server"
import { BlogService } from "@/server/controllers"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

const blogService = new BlogService()

export async function GET(request: Request) {
  try {
    const blogs = await blogService.getPublishedBlogs()
    return NextResponse.json(blogs)
  } catch (error) {
    console.error("获取游记失败:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: errorMessage,
        ...(process.env.NODE_ENV === "development" && { stack: errorStack }),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await authenticateRequest(request as any)
    if (!authResult.authenticated) return authResult.response!

    const user = authResult.user!
    const blogData = await request.json()

    // 用服务端 token 里的用户信息覆盖客户端传入的 userId / author，防止伪造
    const newBlog = await blogService.createBlog({
      ...blogData,
      userId: String(user.id),
      author: {
        name: user.name ?? "",
        avatar: user.avatar ?? "",
      },
    })

    return NextResponse.json(newBlog, { status: 201 })
  } catch (error) {
    console.error("创建游记失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
