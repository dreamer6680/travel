import { NextRequest } from "next/server"
import { proxyStreamToPythonAgent } from "@/server/python-agent-client"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const { dialogText } = await req.json()

  if (!dialogText || !Array.isArray(dialogText)) {
    return new Response(JSON.stringify({ error: "dialogText is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const upstream = await proxyStreamToPythonAgent("/v1/chat/stream", {
      method: "POST",
      body: JSON.stringify({ dialogText }),
    })
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
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