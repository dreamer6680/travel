import { NextResponse } from "next/server"
import { BlogService } from "@/server/controllers"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

const blogService = new BlogService()

/** GET /api/blogs/user — 获取当前登录用户的全部游记（所有状态） */
export async function GET(request: Request) {
  try {
    const authResult = await authenticateRequest(request as any)
    if (!authResult.authenticated) return authResult.response!

    const userId = authResult.user?.id ?? authResult.payload?.userId
    if (!userId) {
      return NextResponse.json({ error: "无法获取用户信息" }, { status: 401 })
    }

    const blogs = await blogService.getBlogsByUserId(String(userId))
    return NextResponse.json(blogs)
  } catch (error) {
    console.error("获取用户游记失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
