import { NextRequest } from "next/server"
import { ChatService } from "@/server/controllers/chatService"

export const runtime = "nodejs"

const chatService = new ChatService()

export async function POST(req: NextRequest) {
  const { dialogText } = await req.json()

  if (!dialogText || !Array.isArray(dialogText)) {
    return new Response(JSON.stringify({ error: "dialogText is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const responseBody = await chatService.sendMessage(dialogText)
    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("聊天服务失败:", error)
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}