import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { dialogText } = await req.json();

  if (!dialogText || !Array.isArray(dialogText)) {
    return new Response(JSON.stringify({ error: "dialogText is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 向 Ollama 的本地 API 发起请求
  const ollamaRes = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemma:2b",
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
        max_tokens: 100,
      },
    }),
  });

  return new Response(ollamaRes.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json", // 必须设置，否则浏览器可能不能解析
    },
  });
}