#!/usr/bin/env tsx
/**
 * 等待本机 Ollama 可访问（向量化脚本依赖 /api/embeddings）
 */
import "./load-env-local"

const OLLAMA_API_URL = (process.env.OLLAMA_API_URL || "http://127.0.0.1:11434").replace(/\/$/, "")
const MAX_RETRIES = 30
const RETRY_DELAY_MS = 2000

async function waitForOllama() {
  console.log("⏳ 等待 Ollama 就绪（向量化需要）...")
  console.log(`📍 ${OLLAMA_API_URL}`)

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${OLLAMA_API_URL}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        console.log("✅ Ollama 已就绪！")
        return
      }
    } catch {
      // retry
    }
    if (i === MAX_RETRIES - 1) break
    console.log(`⏳ 尝试连接 Ollama... (${i + 1}/${MAX_RETRIES})`)
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
  }

  console.error(`
❌ 无法在 ${MAX_RETRIES} 次重试内连接 Ollama。

请先在本机启动 Ollama，并拉取 embedding 模型（与 vectorize 脚本默认一致）：

  # macOS 示例
  brew install ollama
  ollama serve

  # 另开终端
  ollama pull nomic-embed-text

环境变量（可选）：
  OLLAMA_API_URL=http://127.0.0.1:11434
  OLLAMA_EMBEDDING_MODEL=nomic-embed-text
`)
  process.exit(1)
}

waitForOllama()
