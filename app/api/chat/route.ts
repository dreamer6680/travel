import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const result = streamText({
      model: openai("gpt-4o"),
      messages,
      system: `你是一个专业的旅行规划助手和全栈开发专家。你可以：
1. 帮助用户规划旅行行程
2. 推荐旅行目的地和景点
3. 提供旅行建议和实用信息
4. 编写和解释代码（HTML、CSS、JavaScript、React等）
5. 创建网页和应用程序

当用户询问代码相关问题时，请提供清晰的代码示例。
当用户询问旅行相关问题时，请提供详细的建议和推荐。

请用中文回答，代码注释也使用中文。`,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
