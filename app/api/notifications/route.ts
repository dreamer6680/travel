import { NextResponse } from "next/server"
import { NotificationService } from "@/server/controllers"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

const svc = new NotificationService()

/** GET /api/notifications — 获取当前用户通知列表 */
export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request as any)
    if (!auth.authenticated) return auth.response!
    const userId = String(auth.user!.id)

    const [notifications, unreadCount] = await Promise.all([
      svc.getByUserId(userId),
      svc.getUnreadCount(userId),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (err) {
    console.error("获取通知失败:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
