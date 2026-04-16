import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { BlogService, NotificationService } from "@/server/controllers"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

const blogService = new BlogService()
const notifSvc = new NotificationService()

/** POST /api/blogs/[id]/comments — 发表评论或回复 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authenticateRequest(request as any)
    if (!authResult.authenticated) return authResult.response!

    const user = authResult.user!
    const { content, parentId } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 })
    }

    const comment = {
      id: randomUUID(),
      userId: String(user.id),
      userName: user.name ?? "用户",
      userAvatar: user.avatar ?? "",
      content: content.trim(),
      parentId: parentId ?? null,
      createdAt: new Date().toISOString(),
    }

    const blog = await blogService.getBlogById(params.id)
    if (!blog) {
      return NextResponse.json({ error: "游记不存在" }, { status: 404 })
    }

    await blogService.addComment(params.id, comment as any)

    // 发送通知
    if (parentId) {
      // 回复评论：通知被回复的人
      const comments: any[] = blog.comments ?? []
      const parentComment = comments.find((c: any) => c.id === parentId)
      if (parentComment && parentComment.userId !== String(user.id)) {
        notifSvc.create({
          userId: String(parentComment.userId),
          type: "comment_reply",
          title: `${user.name ?? "有人"} 回复了你的评论`,
          body: `在游记《${blog.title}》中：${content.trim().slice(0, 60)}`,
          link: `/blogs/${params.id}`,
        }).catch(console.error)
      }
    } else {
      // 顶层评论：通知游记作者（非自己）
      if (blog.userId && String(blog.userId) !== String(user.id)) {
        notifSvc.create({
          userId: String(blog.userId),
          type: "comment_reply",
          title: `${user.name ?? "有人"} 评论了你的游记`,
          body: `《${blog.title}》：${content.trim().slice(0, 60)}`,
          link: `/blogs/${params.id}`,
        }).catch(console.error)
      }
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error("发表评论失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
