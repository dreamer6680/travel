import { query } from "../db-pg"
import { generateEmbedding, buildAttractionText } from "./vector-service"

export interface Attraction {
  id: number
  name: string
  location: string
  rating: number
  type: string
  description: string
  imageUrl: string
  likes: number
}

export interface AttractionVector {
  id: number
  attraction_id: number
  name: string
  location: string | null
  rating: number | null
  type: string | null
  description: string | null
  image_url: string | null
  likes: number
  embedding: number[]
  metadata: Record<string, any>
  similarity?: number // 相似度分数（在搜索结果中会包含）
}

/**
 * 将景点添加到向量知识库
 */
export async function addAttractionToVectorDB(
  attraction: Attraction
): Promise<void> {
  try {
    // 构建文本用于生成向量
    const text = buildAttractionText(attraction)

    // 生成向量嵌入
    const embedding = await generateEmbedding(text)

    // 构建元数据
    const metadata = {
      originalId: attraction.id,
      location: attraction.location,
      type: attraction.type,
      rating: attraction.rating,
      likes: attraction.likes,
    }

    // 插入到向量数据库
    await query(
      `INSERT INTO attraction_vectors 
       (attraction_id, name, location, rating, type, description, image_url, likes, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10::jsonb)
       ON CONFLICT (attraction_id) 
       DO UPDATE SET 
         name = EXCLUDED.name,
         location = EXCLUDED.location,
         rating = EXCLUDED.rating,
         type = EXCLUDED.type,
         description = EXCLUDED.description,
         image_url = EXCLUDED.image_url,
         likes = EXCLUDED.likes,
         embedding = EXCLUDED.embedding,
         metadata = EXCLUDED.metadata,
         updated_at = CURRENT_TIMESTAMP`,
      [
        attraction.id,
        attraction.name,
        attraction.location,
        attraction.rating,
        attraction.type,
        attraction.description,
        attraction.imageUrl,
        attraction.likes,
        JSON.stringify(embedding),
        JSON.stringify(metadata),
      ]
    )

    console.log(`✅ 已添加景点到向量库: ${attraction.name}`)
  } catch (error) {
    console.error(`❌ 添加景点到向量库失败 (${attraction.name}):`, error)
    throw error
  }
}

/**
 * 批量添加景点到向量知识库
 */
export async function addAttractionsBatch(
  attractions: Attraction[],
  batchSize: number = 10
): Promise<void> {
  console.log(`📦 开始批量添加 ${attractions.length} 个景点到向量库...`)

  for (let i = 0; i < attractions.length; i += batchSize) {
    const batch = attractions.slice(i, i + batchSize)
    console.log(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(attractions.length / batchSize)}`)

    await Promise.all(
      batch.map((attraction) => addAttractionToVectorDB(attraction))
    )

    // 添加延迟，避免 API 速率限制
    if (i + batchSize < attractions.length) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  console.log(`✅ 批量添加完成，共 ${attractions.length} 个景点`)
}

/**
 * 从向量知识库搜索相似景点
 */
export async function searchSimilarAttractions(
  queryEmbedding: number[],
  limit: number = 10,
  threshold: number = 0.7,
  filters?: {
    location?: string
    type?: string
    minRating?: number
  }
): Promise<AttractionVector[]> {
  try {
    let sql = `
      SELECT 
        id,
        attraction_id,
        name,
        location,
        rating,
        type,
        description,
        image_url,
        likes,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM attraction_vectors
      WHERE 1 - (embedding <=> $1::vector) >= $2
    `

    const params: any[] = [JSON.stringify(queryEmbedding), threshold]
    let paramIndex = 3

    // 添加过滤条件
    if (filters?.location) {
      sql += ` AND location ILIKE $${paramIndex}`
      params.push(`%${filters.location}%`)
      paramIndex++
    }

    if (filters?.type) {
      sql += ` AND type = $${paramIndex}`
      params.push(filters.type)
      paramIndex++
    }

    if (filters?.minRating) {
      sql += ` AND rating >= $${paramIndex}`
      params.push(filters.minRating)
      paramIndex++
    }

    sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`
    params.push(limit)

    const result = await query<AttractionVector & { similarity: number }>(sql, params)

    return result.rows.map((row) => ({
      id: row.id,
      attraction_id: row.attraction_id,
      name: row.name,
      location: row.location,
      rating: row.rating,
      type: row.type,
      description: row.description,
      image_url: row.image_url,
      likes: row.likes,
      embedding: row.embedding as any, // pgvector 返回的格式
      metadata: row.metadata,
      similarity: row.similarity,
    }))
  } catch (error) {
    console.error("向量搜索失败:", error)
    throw error
  }
}

/**
 * 获取知识库统计信息
 */
export async function getKnowledgeBaseStats(): Promise<{
  totalAttractions: number
  locations: string[]
  types: string[]
}> {
  try {
    const totalResult = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM attraction_vectors"
    )

    const locationsResult = await query<{ location: string }>(
      "SELECT DISTINCT location FROM attraction_vectors WHERE location IS NOT NULL"
    )

    const typesResult = await query<{ type: string }>(
      "SELECT DISTINCT type FROM attraction_vectors WHERE type IS NOT NULL"
    )

    return {
      totalAttractions: parseInt(totalResult.rows[0].count),
      locations: locationsResult.rows.map((r) => r.location),
      types: typesResult.rows.map((r) => r.type),
    }
  } catch (error) {
    console.error("获取知识库统计失败:", error)
    throw error
  }
}

/**
 * 更新景点向量（当原始数据更新时）
 */
export async function updateAttractionVector(
  attractionId: number,
  attraction: Partial<Attraction>
): Promise<void> {
  try {
    // 获取现有数据
    const existing = await query<AttractionVector>(
      "SELECT * FROM attraction_vectors WHERE attraction_id = $1",
      [attractionId]
    )

    if (existing.rows.length === 0) {
      throw new Error(`景点 ID ${attractionId} 不存在于向量库中`)
    }

    const updated = { ...existing.rows[0], ...attraction }

    // 重新生成向量
    const text = buildAttractionText(updated as Attraction)
    const embedding = await generateEmbedding(text)

    // 更新数据库
    await query(
      `UPDATE attraction_vectors 
       SET name = $1, location = $2, rating = $3, type = $4, 
           description = $5, image_url = $6, likes = $7, 
           embedding = $8::vector, updated_at = CURRENT_TIMESTAMP
       WHERE attraction_id = $9`,
      [
        updated.name,
        updated.location,
        updated.rating,
        updated.type,
        updated.description,
        updated.imageUrl || updated.image_url,
        updated.likes,
        JSON.stringify(embedding),
        attractionId,
      ]
    )

    console.log(`✅ 已更新景点向量: ${updated.name}`)
  } catch (error) {
    console.error(`❌ 更新景点向量失败 (ID: ${attractionId}):`, error)
    throw error
  }
}
