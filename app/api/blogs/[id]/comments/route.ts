import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { BlogService } from "@/server/controllers"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

const blogService = new BlogService()

/** POST /api/blogs/[id]/comments — 发表评论 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authenticateRequest(request as any)
    if (!authResult.authenticated) return authResult.response!

    const user = authResult.user
    if (!user) {
      return NextResponse.json({ error: "无法获取用户信息" }, { status: 401 })
    }

    const { content } = await request.json()
    if (!content?.trim()) {
      return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 })
    }

    const comment = {
      id: randomUUID(),
      userId: String(user.id),
      userName: user.name ?? "用户",
      userAvatar: user.avatar ?? "",
      content: content.trim(),
      createdAt: new Date().toISOString(),
    }

    const result = await blogService.addComment(params.id, comment)
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "游记不存在" }, { status: 404 })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error("发表评论失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
