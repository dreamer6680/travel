import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/server/middleware/auth.middleware"
import { chatService } from "@/server/controllers/chatService"

/** GET /api/chat/history — list sessions for authenticated user */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request as any)
  if (!auth.authenticated) return auth.response!
  const userId = String(auth.user!.id)
  const sessions = await chatService.getSessionsByUserId(userId)
  return NextResponse.json(sessions)
}

/**
 * POST /api/chat/history
 * Body: { sessionId?: string; userMessage: string; assistantMessage: string }
 * Creates session if sessionId is absent, then appends both messages.
 * Returns: { sessionId: string; isNew: boolean }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request as any)
  if (!auth.authenticated) return auth.response!
  const userId = String(auth.user!.id)

  const { sessionId, userMessage, assistantMessage } = await request.json()

  let id = sessionId as string | undefined
  const isNew = !id
  if (isNew) {
    id = await chatService.createSession(userId, userMessage)
  }

  await chatService.appendMessages(id!, userId, [
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantMessage },
  ])

  return NextResponse.json({ sessionId: id, isNew })
}
