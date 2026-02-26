// @ts-ignore - OpenAI 类型定义
import OpenAI from "openai"

// 使用的嵌入模型
const EMBEDDING_MODEL = "text-embedding-3-small"
const EMBEDDING_DIMENSIONS = 1536

// Ollama 嵌入模型配置
const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"
const OLLAMA_EMBEDDING_DIMENSIONS = 768 // nomic-embed-text 的维度
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434"

// 延迟初始化 OpenAI 客户端
let openaiInstance: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY 环境变量未设置。请在 .env.local 文件中添加：\n" +
        "OPENAI_API_KEY=your-api-key-here"
      )
    }
    openaiInstance = new OpenAI({
      apiKey,
    })
  }
  return openaiInstance
}

/**
 * 使用 Ollama 生成向量嵌入
 */
async function generateEmbeddingWithOllama(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_EMBEDDING_MODEL,
        prompt: text,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API 错误: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error("Ollama 返回的数据格式不正确")
    }

    return data.embedding
  } catch (error: any) {
    if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
      throw new Error(
        `无法连接到 Ollama 服务 (${OLLAMA_API_URL})。\n` +
        `请确保 Ollama 正在运行：\n` +
        `1. 启动 Ollama: ollama serve\n` +
        `2. 下载嵌入模型: ollama pull ${OLLAMA_EMBEDDING_MODEL}`
      )
    }
    throw error
  }
}

/**
 * 检查 Ollama 服务是否可用
 */
async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2000), // 2秒超时
    })
    return response.ok
  } catch {
    return false
  }
}

export interface EmbeddingResult {
  embedding: number[]
  model: string
  dimensions: number
}

/**
 * 生成文本的向量嵌入
 * 优先使用 OpenAI，失败时自动降级到 Ollama
 */
export async function generateEmbedding(
  text: string
): Promise<number[]> {
  // 如果设置了禁用向量工作流，直接使用 Ollama
  if (process.env.USE_VECTOR_WORKFLOW === "false") {
    console.log("使用 Ollama 生成向量嵌入（USE_VECTOR_WORKFLOW=false）")
    return await generateEmbeddingWithOllama(text)
  }

  // 尝试使用 OpenAI
  try {
    const openai = getOpenAIClient()
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    })

    return response.data[0].embedding
  } catch (error: any) {
    console.warn("OpenAI 生成向量嵌入失败，尝试降级到 Ollama:", error?.message || error)
    
    // 检查是否是 API key 问题、配额错误或其他可恢复的错误
    const isAPIKeyError = 
      error?.status === 401 ||
      error?.code === 'invalid_api_key' ||
      error?.code === 'authentication_error' ||
      error?.message?.includes('401') ||
      error?.message?.includes('Incorrect API key') ||
      error?.message?.includes('Invalid API key') ||
      error?.message?.includes('authentication') ||
      !process.env.OPENAI_API_KEY
    
    const isQuotaError = 
      error?.status === 429 || 
      error?.code === 'insufficient_quota' ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota')
    
    const shouldFallback = isAPIKeyError || isQuotaError

    if (shouldFallback) {
      if (isAPIKeyError) {
        console.warn("⚠️  OpenAI API Key 无效或未设置，降级到 Ollama")
      } else {
        console.warn("⚠️  OpenAI API 配额超限，降级到 Ollama")
      }
      try {
        const ollamaAvailable = await checkOllamaAvailable()
        if (ollamaAvailable) {
          console.log("降级到 Ollama 生成向量嵌入")
          return await generateEmbeddingWithOllama(text)
        } else {
          throw new Error(
            "OpenAI API 不可用，且 Ollama 服务未运行。\n" +
            "请选择以下方案之一：\n" +
            "1. 启动 Ollama: ollama serve\n" +
            "2. 下载嵌入模型: ollama pull nomic-embed-text\n" +
            "3. 或配置有效的 OPENAI_API_KEY"
          )
        }
      } catch (ollamaError: any) {
        throw new Error(
          `生成向量嵌入失败：\n` +
          `- OpenAI 错误: ${error?.message || "Unknown"}\n` +
          `- Ollama 降级失败: ${ollamaError?.message || "Unknown"}\n` +
          `请检查服务配置`
        )
      }
    }
    
    throw new Error(`生成向量嵌入失败: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * 批量生成向量嵌入
 * 优先使用 OpenAI，失败时自动降级到 Ollama
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 100
): Promise<number[][]> {
  // 如果设置了禁用向量工作流，直接使用 Ollama
  if (process.env.USE_VECTOR_WORKFLOW === "false") {
    console.log(`使用 Ollama 批量生成 ${texts.length} 个向量嵌入`)
    const embeddings: number[][] = []
    
    // Ollama 需要逐个处理
    for (let i = 0; i < texts.length; i++) {
      try {
        const embedding = await generateEmbeddingWithOllama(texts[i])
        embeddings.push(embedding)
        
        // 添加小延迟，避免过载
        if (i < texts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      } catch (error) {
        console.error(`Ollama 生成向量嵌入失败 (第 ${i + 1}/${texts.length} 个):`, error)
        throw error
      }
    }
    
    return embeddings
  }

  // 尝试使用 OpenAI 批量处理
  const embeddings: number[][] = []
  let useOllama = false

  try {
    const openai = getOpenAIClient()

    // 分批处理，避免 API 限制
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      
      try {
        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
          dimensions: EMBEDDING_DIMENSIONS,
        })

        const batchEmbeddings = response.data.map((item: any) => item.embedding)
        embeddings.push(...batchEmbeddings)

        // 添加延迟，避免速率限制
        if (i + batchSize < texts.length) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error: any) {
        // 检查是否是 API key 问题、配额错误或其他可恢复的错误
        const isAPIKeyError = 
          error?.status === 401 ||
          error?.code === 'invalid_api_key' ||
          error?.code === 'authentication_error' ||
          error?.message?.includes('401') ||
          error?.message?.includes('Incorrect API key') ||
          error?.message?.includes('Invalid API key') ||
          error?.message?.includes('authentication') ||
          !process.env.OPENAI_API_KEY
        
        const isQuotaError = 
          error?.status === 429 || 
          error?.code === 'insufficient_quota' ||
          error?.message?.includes('429') ||
          error?.message?.includes('quota')
        
        const shouldFallback = isAPIKeyError || isQuotaError

        if (shouldFallback && !useOllama) {
          if (isAPIKeyError) {
            console.warn(`⚠️  OpenAI API Key 无效 (批次 ${Math.floor(i / batchSize) + 1})，降级到 Ollama`)
          } else {
            console.warn(`⚠️  OpenAI API 配额超限 (批次 ${Math.floor(i / batchSize) + 1})，降级到 Ollama`)
          }
          useOllama = true
          
          // 检查 Ollama 是否可用
          const ollamaAvailable = await checkOllamaAvailable()
          if (!ollamaAvailable) {
            throw new Error(
              "OpenAI API 不可用，且 Ollama 服务未运行。\n" +
              "请启动 Ollama: ollama serve"
            )
          }
          
          // 使用 Ollama 处理剩余的所有文本
          for (let j = i; j < texts.length; j++) {
            try {
              const embedding = await generateEmbeddingWithOllama(texts[j])
              embeddings.push(embedding)
              
              // 添加延迟
              if (j < texts.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 50))
              }
            } catch (ollamaError) {
              console.error(`Ollama 生成向量嵌入失败 (第 ${j + 1}/${texts.length} 个):`, ollamaError)
              throw ollamaError
            }
          }
          break // 已处理完所有文本
        } else {
          throw error
        }
      }
    }

    return embeddings
  } catch (error: any) {
    // 如果还没有尝试 Ollama，且错误是可恢复的，尝试降级
    if (!useOllama) {
      const shouldFallback = 
        error?.status === 429 || 
        error?.code === 'insufficient_quota' ||
        error?.message?.includes('429') ||
        error?.message?.includes('quota') ||
        !process.env.OPENAI_API_KEY

      if (shouldFallback) {
        console.warn("OpenAI 批量生成完全失败，降级到 Ollama")
        const ollamaAvailable = await checkOllamaAvailable()
        if (ollamaAvailable) {
          // 使用 Ollama 处理所有文本
          const ollamaEmbeddings: number[][] = []
          for (let i = 0; i < texts.length; i++) {
            try {
              const embedding = await generateEmbeddingWithOllama(texts[i])
              ollamaEmbeddings.push(embedding)
              
              if (i < texts.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 50))
              }
            } catch (ollamaError) {
              console.error(`Ollama 生成向量嵌入失败 (第 ${i + 1}/${texts.length} 个):`, ollamaError)
              throw ollamaError
            }
          }
          return ollamaEmbeddings
        }
      }
    }
    
    throw error
  }
}

/**
 * 为景点生成向量嵌入文本
 * 组合多个字段以提供更丰富的语义信息
 */
export function buildAttractionText(attraction: {
  name: string
  location?: string
  type?: string
  description?: string
  rating?: number
}): string {
  const parts: string[] = []

  // 名称
  parts.push(attraction.name)

  // 位置
  if (attraction.location) {
    parts.push(`位于 ${attraction.location}`)
  }

  // 类型
  if (attraction.type) {
    parts.push(`类型: ${attraction.type}`)
  }

  // 描述
  if (attraction.description) {
    parts.push(attraction.description)
  }

  // 评分
  if (attraction.rating) {
    parts.push(`评分: ${attraction.rating} 星`)
  }

  return parts.join(". ")
}

/**
 * 为用户偏好生成向量嵌入文本
 */
export function buildUserPreferenceText(preferences: {
  destination?: string
  travelStyle?: string
  interests?: string | string[]
  budget?: number
  travelers?: number
}): string {
  const parts: string[] = []

  if (preferences.destination) {
    parts.push(`目的地: ${preferences.destination}`)
  }

  if (preferences.travelStyle) {
    parts.push(`旅行风格: ${preferences.travelStyle}`)
  }

  if (preferences.interests) {
    const interestsText = Array.isArray(preferences.interests)
      ? preferences.interests.join(", ")
      : preferences.interests
    parts.push(`兴趣偏好: ${interestsText}`)
  }

  if (preferences.budget) {
    parts.push(`预算: ${preferences.budget} 元`)
  }

  if (preferences.travelers) {
    parts.push(`旅行人数: ${preferences.travelers} 人`)
  }

  return parts.join(". ")
}

export { 
  EMBEDDING_MODEL, 
  EMBEDDING_DIMENSIONS,
  OLLAMA_EMBEDDING_MODEL,
  OLLAMA_EMBEDDING_DIMENSIONS 
}
