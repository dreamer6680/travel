import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "deepseek-r1"

export async function POST(req: NextRequest) {
  try {
    const { dialogText } = await req.json()

    if (!dialogText || !Array.isArray(dialogText)) {
      return NextResponse.json({ error: "dialogText is required" }, { status: 400 })
    }

    const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: "system",
            content: "你是一个简洁助手，只返回简短回答，不进行任何延伸或推理。",
          },
          {
            role: "system",
            content: `你是一个专业的旅行规划助手和全栈开发专家。你可以：
                    1. 帮助用户规划旅行行程
                    2. 推荐旅行目的地和景点
                    3. 提供旅行建议和实用信息
                    4. 编写和解释代码（HTML、CSS、JavaScript、React等）
                    5. 创建网页和应用程序

                    当用户询问代码相关问题时，请提供清晰的代码示例。
                    当用户询问旅行相关问题时，请提供详细的建议和推荐。

                    请用中文回答，代码注释也使用中文。`,
          },
          ...dialogText,
        ],
        stream: true,
        options: {
          temperature: 0.7,
          num_predict: 200,
        },
      }),
    })

    if (!ollamaRes.ok || !ollamaRes.body) {
      const errorText = await ollamaRes.text().catch(() => "")
      return NextResponse.json(
        {
          error: errorText || "AI 服务暂时不可用，请确认本地 Ollama 已启动",
        },
        { status: ollamaRes.status || 502 },
      )
    }

    return new Response(ollamaRes.body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("聊天接口请求失败:", error)
    return NextResponse.json(
      { error: "AI 服务连接失败，请确认本地 Ollama 已启动并可访问" },
      { status: 502 },
    )
  }
}
