import { query } from "../db-pg"
import { generateEmbedding, buildAttractionText, buildUserPreferenceText, buildHotelText } from "./vector-service"

/**
 * 确保向量索引存在（在首次插入数据后调用）
 */
async function ensureVectorIndexes() {
  try {
    const getVectorColumnType = async (tableName: string, columnName: string) => {
      const res = await query<{ full_type: string }>(
        `
        SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) as full_type
        FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND c.relname = $1
          AND a.attname = $2
          AND NOT a.attisdropped
          AND a.attnum > 0
      `,
        [tableName, columnName]
      )
      return res.rows[0]?.full_type ?? null
    }

    // 检查景点向量索引
    const attractionIndexCheck = await query(`
      SELECT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'attraction_vectors' 
        AND indexname = 'attraction_vectors_embedding_idx'
      )
    `)

    if (!attractionIndexCheck.rows[0].exists) {
      const colType = await getVectorColumnType("attraction_vectors", "embedding")
      if (!colType) return
      if (!/^vector\(\d+\)$/.test(colType)) {
        // embedding 是动态 vector（无维度），pgvector 无法创建 HNSW/IVFFLAT 索引
        return
      }

      // 检查是否有数据，并获取一个向量来验证维度
      const dataCheck = await query(
        "SELECT embedding FROM attraction_vectors WHERE embedding IS NOT NULL LIMIT 1"
      )
      if (dataCheck.rows.length > 0) {
        try {
          await query(`
            CREATE INDEX attraction_vectors_embedding_idx 
            ON attraction_vectors 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
          `)
        } catch {
          // 不影响主流程
        }
      }
    }

    // 检查用户偏好向量索引
    const userPrefIndexCheck = await query(`
      SELECT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'user_preference_vectors' 
        AND indexname = 'user_preference_vectors_embedding_idx'
      )
    `)

    if (!userPrefIndexCheck.rows[0].exists) {
      const colType = await getVectorColumnType("user_preference_vectors", "embedding")
      if (!colType) return
      if (!/^vector\(\d+\)$/.test(colType)) {
        // embedding 是动态 vector（无维度），pgvector 无法创建 HNSW/IVFFLAT 索引
        return
      }

      // 检查是否有数据，并获取一个向量来验证维度
      const dataCheck = await query(
        "SELECT embedding FROM user_preference_vectors WHERE embedding IS NOT NULL LIMIT 1"
      )
      if (dataCheck.rows.length > 0) {
        try {
          await query(`
            CREATE INDEX user_preference_vectors_embedding_idx 
            ON user_preference_vectors 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
          `)
        } catch {
          // 不影响主流程
        }
      }
    }
  } catch (error) {
    // 索引创建失败不影响主流程
    console.warn("创建向量索引失败（不影响数据插入）:", error)
  }
}

export interface Attraction {
  id: number
  name: string
  location: string
  rating: number
  type: string
  description: string
  imageUrl: string
  likes: number
  // 经纬度坐标（可选）
  coordinate?: {
    latitude: number
    longitude: number
    coordinateType?: string // 'BD09' | 'WGS84' | 'GCJ02'
  }
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
  latitude: number | null
  longitude: number | null
  coordinate_type: string | null
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

    // 构建元数据（包含坐标信息）
    const metadata: any = {
      originalId: attraction.id,
      location: attraction.location,
      type: attraction.type,
      rating: attraction.rating,
      likes: attraction.likes,
    }
    
    // 如果有坐标信息，添加到元数据中
    if (attraction.coordinate) {
      metadata.coordinate = {
        latitude: attraction.coordinate.latitude,
        longitude: attraction.coordinate.longitude,
        coordinateType: attraction.coordinate.coordinateType || 'BD09',
      }
    }

    // 检查是否已存在
    const existing = await query<AttractionVector>(
      "SELECT id FROM attraction_vectors WHERE attraction_id = $1",
      [attraction.id]
    )

    // 提取坐标信息
    const latitude = attraction.coordinate?.latitude || null
    const longitude = attraction.coordinate?.longitude || null
    const coordinateType = attraction.coordinate?.coordinateType || 'BD09'

    if (existing.rows.length > 0) {
      // 更新现有记录
      await query(
        `UPDATE attraction_vectors 
         SET name = $1,
             location = $2,
             rating = $3,
             type = $4,
             description = $5,
             image_url = $6,
             likes = $7,
             latitude = $8,
             longitude = $9,
             coordinate_type = $10,
             embedding = $11::vector,
             metadata = $12::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE attraction_id = $13`,
        [
          attraction.name,
          attraction.location,
          attraction.rating,
          attraction.type,
          attraction.description,
          attraction.imageUrl,
          attraction.likes,
          latitude,
          longitude,
          coordinateType,
          JSON.stringify(embedding),
          JSON.stringify(metadata),
          attraction.id,
        ]
      )
    } else {
      // 插入新记录
      await query(
        `INSERT INTO attraction_vectors 
         (attraction_id, name, location, rating, type, description, image_url, likes, latitude, longitude, coordinate_type, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector, $13::jsonb)`,
        [
          attraction.id,
          attraction.name,
          attraction.location,
          attraction.rating,
          attraction.type,
          attraction.description,
          attraction.imageUrl,
          attraction.likes,
          latitude,
          longitude,
          coordinateType,
          JSON.stringify(embedding),
          JSON.stringify(metadata),
        ]
      )
    }

    console.log(`✅ 已添加景点到向量库: ${attraction.name}`)
    
    // 注意：向量索引将在批量插入完成后统一创建，避免频繁创建失败
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
  
  // 批量插入完成后，尝试创建向量索引
  await ensureVectorIndexes()
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
        latitude,
        longitude,
        coordinate_type,
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
      latitude: row.latitude,
      longitude: row.longitude,
      coordinate_type: row.coordinate_type,
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

/**
 * 保存或更新用户偏好向量到向量数据库
 * 用于缓存用户偏好向量，提高相似度匹配性能
 */
export async function saveUserPreferenceVector(
  userId: string,
  preferences: {
    destination?: string
    travelStyle?: string
    interests?: string | string[]
    budget?: number
    travelers?: number
    favoriteDestinations?: string[]
    seasons?: string[]
    accommodationType?: string
    transportationPreference?: string
  }
): Promise<void> {
  try {
    // 构建偏好文本
    const preferenceText = buildUserPreferenceText({
      destination: preferences.destination,
      travelStyle: preferences.travelStyle,
      interests: preferences.interests,
      budget: preferences.budget,
      travelers: preferences.travelers,
    })

    // 如果偏好文本为空，跳过
    if (!preferenceText || preferenceText.trim().length === 0) {
      console.log(`⚠️  用户 ${userId} 的偏好为空，跳过向量存储`)
      return
    }

    // 生成向量嵌入
    const embedding = await generateEmbedding(preferenceText)

    // 构建元数据
    const metadata = {
      travelStyle: preferences.travelStyle,
      favoriteDestinations: preferences.favoriteDestinations || [],
      interests: Array.isArray(preferences.interests) 
        ? preferences.interests 
        : (preferences.interests ? [preferences.interests] : []),
      seasons: preferences.seasons || [],
      accommodationType: preferences.accommodationType,
      transportationPreference: preferences.transportationPreference,
      budget: preferences.budget,
      travelers: preferences.travelers,
    }

    // 检查是否已存在该用户的偏好向量
    const existing = await query(
      "SELECT id FROM user_preference_vectors WHERE user_id = $1",
      [userId]
    )

    if (existing.rows.length > 0) {
      // 更新现有记录
      await query(
        `UPDATE user_preference_vectors 
         SET preference_text = $1, 
             embedding = $2::vector, 
             metadata = $3::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4`,
        [
          preferenceText,
          JSON.stringify(embedding),
          JSON.stringify(metadata),
          userId,
        ]
      )
    } else {
      // 插入新记录
      await query(
        `INSERT INTO user_preference_vectors 
         (user_id, preference_text, embedding, metadata)
         VALUES ($1, $2, $3::vector, $4::jsonb)`,
        [
          userId,
          preferenceText,
          JSON.stringify(embedding),
          JSON.stringify(metadata),
        ]
      )
    }

    console.log(`✅ 已保存用户偏好向量: ${userId}`)
    
    // 在首次插入后，确保向量索引存在
    await ensureVectorIndexes()
  } catch (error) {
    console.error(`❌ 保存用户偏好向量失败 (${userId}):`, error)
    // 不抛出错误，避免影响主流程
    // 偏好向量存储失败不应该阻止偏好设置的更新
  }
}

// ---------- 酒店向量 ----------

/** 房型简要（与携程 roomInfo 一致） */
export interface HotelRoomInfo {
  roomName: string
  roomId?: string
  price?: number
  priceDisplay?: string
  deleteDisplayPrice?: string
  bedSummary?: string
}

export interface Hotel {
  hotelId: string
  name: string
  location: string
  star: number
  starType?: number
  description?: string
  imageUrl?: string
  score?: string
  commentNumber?: string
  priceDisplay?: string
  priceYuan?: number
  address?: string
  positionDesc?: string
  zoneNames?: string[]
  latitude?: number
  longitude?: number
  coordinateType?: string
  roomInfo?: HotelRoomInfo[]
}

export interface HotelVectorRow {
  id: number
  hotel_id: string
  name: string
  location: string | null
  star: number
  rating: number | null
  price_display: string | null
  price_yuan: number | null
  address?: string | null
  position_desc?: string | null
  zone_names?: unknown
  latitude?: number | null
  longitude?: number | null
  coordinate_type?: string | null
  rooms?: unknown
}

/** 解析价格字符串 "¥606" -> 606 */
function parsePriceYuan(s: string): number | null {
  if (!s || typeof s !== "string") return null
  const num = parseFloat(s.replace(/[¥¥,\s]/g, ""))
  return isNaN(num) ? null : num
}

/** 将酒店添加到向量库 */
export async function addHotelToVectorDB(hotel: Hotel): Promise<void> {
  const text = buildHotelText({
    name: hotel.name,
    location: hotel.location,
    star: hotel.star,
    description: hotel.description,
    score: hotel.score,
    commentNumber: hotel.commentNumber,
    priceDisplay: hotel.priceDisplay,
    address: hotel.address,
    positionDesc: hotel.positionDesc,
    zoneNames: hotel.zoneNames,
    roomInfo: hotel.roomInfo,
  })
  const embedding = await generateEmbedding(text)
  const metadata = {
    hotelId: hotel.hotelId,
    location: hotel.location,
    star: hotel.star,
    score: hotel.score,
    priceYuan: hotel.priceYuan,
    address: hotel.address,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
  }

  const existing = await query<{ id: number }>(
    "SELECT id FROM hotel_vectors WHERE hotel_id = $1",
    [hotel.hotelId]
  )
  const rating = hotel.score ? parseFloat(hotel.score) : null
  const priceYuan = hotel.priceYuan ?? (hotel.priceDisplay ? parsePriceYuan(hotel.priceDisplay) : null)
  const zoneNamesJson = hotel.zoneNames?.length ? JSON.stringify(hotel.zoneNames) : null
  const roomsJson = hotel.roomInfo?.length ? JSON.stringify(hotel.roomInfo) : null

  if (existing.rows.length > 0) {
    await query(
      `UPDATE hotel_vectors SET name = $1, location = $2, star = $3, star_type = $4, type = $5,
       description = $6, image_url = $7, rating = $8, comment_number = $9, price_display = $10, price_yuan = $11,
       address = $12, position_desc = $13, zone_names = $14::jsonb, latitude = $15, longitude = $16, coordinate_type = $17, rooms = $18::jsonb,
       embedding = $19::vector, metadata = $20::jsonb, updated_at = CURRENT_TIMESTAMP WHERE hotel_id = $21`,
      [
        hotel.name,
        hotel.location,
        hotel.star,
        hotel.starType ?? 0,
        "酒店",
        hotel.description ?? null,
        hotel.imageUrl ?? null,
        rating,
        hotel.commentNumber ?? null,
        hotel.priceDisplay ?? null,
        priceYuan,
        hotel.address ?? null,
        hotel.positionDesc ?? null,
        zoneNamesJson,
        hotel.latitude ?? null,
        hotel.longitude ?? null,
        hotel.coordinateType ?? null,
        roomsJson,
        JSON.stringify(embedding),
        JSON.stringify(metadata),
        hotel.hotelId,
      ]
    )
  } else {
    await query(
      `INSERT INTO hotel_vectors (hotel_id, name, location, star, star_type, type, description, image_url, rating, comment_number, price_display, price_yuan, address, position_desc, zone_names, latitude, longitude, coordinate_type, rooms, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5, '酒店', $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18::jsonb, $19::vector, $20::jsonb)`,
      [
        hotel.hotelId,
        hotel.name,
        hotel.location,
        hotel.star,
        hotel.starType ?? 0,
        hotel.description ?? null,
        hotel.imageUrl ?? null,
        rating,
        hotel.commentNumber ?? null,
        hotel.priceDisplay ?? null,
        priceYuan,
        hotel.address ?? null,
        hotel.positionDesc ?? null,
        zoneNamesJson,
        hotel.latitude ?? null,
        hotel.longitude ?? null,
        hotel.coordinateType ?? null,
        roomsJson,
        JSON.stringify(embedding),
        JSON.stringify(metadata),
      ]
    )
  }
}

/** 批量添加酒店到向量库 */
export async function addHotelsBatch(hotels: Hotel[], batchSize = 5): Promise<void> {
  for (let i = 0; i < hotels.length; i += batchSize) {
    const batch = hotels.slice(i, i + batchSize)
    await Promise.all(batch.map((h) => addHotelToVectorDB(h)))
    if (i + batchSize < hotels.length) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
}

/** 按目的地（城市名）查询酒店，用于行程住宿推荐；含经纬度便于选最合适酒店 */
export async function searchHotelsByLocation(
  locationKeyword: string,
  limit = 10
): Promise<
  Array<{
    name: string
    location: string | null
    star: number
    rating: number | null
    priceDisplay: string | null
    priceYuan: number | null
    latitude: number | null
    longitude: number | null
  }>
> {
  const result = await query<HotelVectorRow>(
    `SELECT id, hotel_id, name, location, star, rating, price_display, price_yuan, latitude, longitude
     FROM hotel_vectors
     WHERE location ILIKE $1
     ORDER BY rating DESC NULLS LAST, star DESC
     LIMIT $2`,
    [`%${locationKeyword}%`, limit]
  )
  return result.rows.map((r) => ({
    name: r.name,
    location: r.location,
    star: r.star,
    rating: r.rating != null ? Number(r.rating) : null,
    priceDisplay: r.price_display,
    priceYuan: r.price_yuan != null ? Number(r.price_yuan) : null,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
  }))
}
