// @ts-ignore - OpenAI 类型定义
import OpenAI from "openai"

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 使用的嵌入模型
const EMBEDDING_MODEL = "text-embedding-3-small"
const EMBEDDING_DIMENSIONS = 1536

export interface EmbeddingResult {
  embedding: number[]
  model: string
  dimensions: number
}

/**
 * 生成文本的向量嵌入
 */
export async function generateEmbedding(
  text: string
): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 环境变量未设置")
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    })

    return response.data[0].embedding
  } catch (error) {
    console.error("生成向量嵌入失败:", error)
    throw new Error(`生成向量嵌入失败: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * 批量生成向量嵌入
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 100
): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 环境变量未设置")
  }

  const embeddings: number[][] = []

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
    } catch (error) {
      console.error(`批量生成向量嵌入失败 (批次 ${i / batchSize + 1}):`, error)
      throw error
    }
  }

  return embeddings
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

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS }
