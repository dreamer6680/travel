import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/server/middleware/auth.middleware"
import { chatService } from "@/server/controllers/chatService"

/** GET /api/chat/history/[sessionId] — load full session with messages */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const auth = await authenticateRequest(request as any)
  if (!auth.authenticated) return auth.response!
  const userId = String(auth.user!.id)
  const session = await chatService.getSessionById(params.sessionId, userId)
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(session)
}

/** DELETE /api/chat/history/[sessionId] — delete a session */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const auth = await authenticateRequest(request as any)
  if (!auth.authenticated) return auth.response!
  const userId = String(auth.user!.id)
  await chatService.deleteSession(params.sessionId, userId)
  return NextResponse.json({ ok: true })
}
