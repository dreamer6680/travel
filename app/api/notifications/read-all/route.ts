import { NextResponse } from "next/server"
import { NotificationService } from "@/server/controllers"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

const svc = new NotificationService()

/** PATCH /api/notifications/read-all — 全部标记已读 */
export async function PATCH(request: Request) {
  try {
    const auth = await authenticateRequest(request as any)
    if (!auth.authenticated) return auth.response!
    await svc.markAllAsRead(String(auth.user!.id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
