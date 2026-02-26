export class ChatService {
  /**
   * 发送聊天消息到 Ollama
   */
  async sendMessage(dialogText: any[]) {
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
    })

    return ollamaRes.body
  }
}

