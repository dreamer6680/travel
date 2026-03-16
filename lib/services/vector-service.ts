// Agent 仅使用本地 Ollama 生成向量，不再使用 OpenAI
const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"
const OLLAMA_EMBEDDING_DIMENSIONS = 768 // nomic-embed-text 的维度
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434"

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

export interface EmbeddingResult {
  embedding: number[]
  model: string
  dimensions: number
}

/**
 * 生成文本的向量嵌入（仅使用 Ollama）
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return generateEmbeddingWithOllama(text)
}

/**
 * 批量生成向量嵌入（仅使用 Ollama）
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  _batchSize: number = 100
): Promise<number[][]> {
  const embeddings: number[][] = []
  for (let i = 0; i < texts.length; i++) {
    const embedding = await generateEmbeddingWithOllama(texts[i])
    embeddings.push(embedding)
    if (i < texts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 50))
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
 * 为酒店生成向量嵌入文本（用于语义检索），含位置、地址、房型
 */
export function buildHotelText(hotel: {
  name: string
  location?: string
  star?: number
  description?: string
  score?: string
  commentNumber?: string
  priceDisplay?: string
  address?: string
  positionDesc?: string
  zoneNames?: string[]
  roomInfo?: Array<{ roomName: string; priceDisplay?: string; bedSummary?: string }>
}): string {
  const parts: string[] = [hotel.name]
  if (hotel.location) parts.push("位于 " + hotel.location)
  if (hotel.positionDesc) parts.push(hotel.positionDesc)
  if (hotel.address) parts.push("地址 " + hotel.address)
  if (hotel.zoneNames?.length) parts.push("商圈 " + hotel.zoneNames.join(" "))
  if (hotel.star != null) parts.push(hotel.star + "星酒店")
  if (hotel.description) parts.push(hotel.description)
  if (hotel.score) parts.push("评分 " + hotel.score)
  if (hotel.commentNumber) parts.push(hotel.commentNumber)
  if (hotel.priceDisplay) parts.push("价格 " + hotel.priceDisplay)
  if (hotel.roomInfo?.length) {
    const roomNames = hotel.roomInfo.slice(0, 5).map((r) => r.roomName || r.priceDisplay).filter(Boolean)
    if (roomNames.length) parts.push("房型 " + roomNames.join("、"))
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
  OLLAMA_EMBEDDING_MODEL,
  OLLAMA_EMBEDDING_DIMENSIONS,
}
