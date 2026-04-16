import { NextResponse } from "next/server"
import { BlogService, NotificationService } from "@/server/controllers"
import { authenticateRequest, checkRole } from "@/server/middleware/auth.middleware"

const blogService = new BlogService()
const notifSvc = new NotificationService()

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

    // 先获取游记以拿到 userId 和 title
    const blog = await blogService.getBlogById(params.id)
    if (!blog) {
      return NextResponse.json({ error: "游记不存在" }, { status: 404 })
    }

    const result = await blogService.togglePublish(params.id, status)
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "游记不存在" }, { status: 404 })
    }

    // 发送审核通知给作者
    if (blog.userId && (status === "published" || status === "pending")) {
      const approved = status === "published"
      notifSvc.create({
        userId: String(blog.userId),
        type: approved ? "blog_approved" : "blog_rejected",
        title: approved ? "游记审核通过 🎉" : "游记已下架",
        body: approved
          ? `您的游记《${blog.title}》已通过审核，现已公开展示`
          : `您的游记《${blog.title}》已被下架，如有疑问请联系管理员`,
        link: approved ? `/blogs/${params.id}` : "/my-blogs",
      }).catch(console.error)
    }

    return NextResponse.json({ message: "状态更新成功", status })
  } catch (error) {
    console.error("更新游记状态失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
