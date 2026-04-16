import { NextResponse } from "next/server"
import { BlogService } from "@/server/controllers"
import { authenticateRequest, checkRole } from "@/server/middleware/auth.middleware"

const blogService = new BlogService()

/** PATCH /api/blogs/[id]/publish — 切换游记发布状态 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authenticateRequest(request as any)
    if (!authResult.authenticated) return authResult.response!

    if (!checkRole(authResult.user?.role ?? "", ["admin"])) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    const { status } = await request.json() as { status: "published" | "pending" | "draft" }
    if (!["published", "pending", "draft"].includes(status)) {
      return NextResponse.json({ error: "status 只能是 published / pending / draft" }, { status: 400 })
    }

    const result = await blogService.togglePublish(params.id, status)
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "游记不存在" }, { status: 404 })
    }

    return NextResponse.json({ message: "状态更新成功", status })
  } catch (error) {
    console.error("更新游记状态失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
