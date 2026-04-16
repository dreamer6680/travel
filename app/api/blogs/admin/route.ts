import { NextResponse } from "next/server"
import { BlogService } from "@/server/controllers"
import { authenticateRequest, checkRole } from "@/server/middleware/auth.middleware"

const blogService = new BlogService()

/** GET /api/blogs/admin — 管理员获取全部游记（含草稿） */
export async function GET(request: Request) {
  try {
    const authResult = await authenticateRequest(request as any)
    if (!authResult.authenticated) return authResult.response!

    if (!checkRole(authResult.user?.role ?? "", ["admin"])) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    const blogs = await blogService.getAllBlogs()
    return NextResponse.json(blogs)
  } catch (error) {
    console.error("获取所有游记失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
