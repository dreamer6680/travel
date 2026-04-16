import { authenticateRequest } from "@/server/middleware/auth.middleware"
import { NotificationService } from "@/server/controllers"
import { subscribeNotifications } from "@/server/realtime/notification-bus"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const notificationService = new NotificationService()

/** GET /api/notifications/stream — SSE 实时通知流 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request as any)
  if (!auth.authenticated) return auth.response!
  const userId = String(auth.user!.id)

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      send("connected", { ok: true, userId })

      const [notifications, unreadCount] = await Promise.all([
        notificationService.getByUserId(userId),
        notificationService.getUnreadCount(userId),
      ])
      send("snapshot", { notifications, unreadCount })

      const unsubscribe = await subscribeNotifications((evt) => {
        if (evt.userId !== userId) return
        send("notification", evt.notification)
      })

      const heartbeat = setInterval(() => {
        send("heartbeat", { ts: Date.now() })
      }, 25_000)

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        unsubscribe()
        controller.close()
      })
    },
    cancel() {
      // 资源清理由 request.abort 处理
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

