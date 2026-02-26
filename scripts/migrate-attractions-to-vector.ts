#!/usr/bin/env tsx
/**
 * 从 MongoDB 迁移景点数据到 PostgreSQL + pgvector
 */

import clientPromise from "../lib/db"
import { MONGODB_DB_NAME } from "../lib/db"
import { addAttractionsBatch } from "../lib/services/knowledge-base-service"
import { initPgVector } from "../lib/db-pg"
import { closePool } from "../lib/db-pg"

interface MongoAttraction {
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
    coordinateType?: string
  }
}

async function migrateAttractions() {
  try {
    console.log("🚀 开始迁移景点数据到向量库...")

    // 初始化 pgvector
    await initPgVector()

    // 从 MongoDB 读取景点数据
    console.log("📖 从 MongoDB 读取景点数据...")
    const mongoClient = await clientPromise
    const mongoDb = mongoClient.db(MONGODB_DB_NAME)
    const attractionsCollection = mongoDb.collection<MongoAttraction>("Recomendations")

    const mongoAttractions = await attractionsCollection.find({}).toArray()
    console.log(`✅ 从 MongoDB 读取到 ${mongoAttractions.length} 个景点`)

    if (mongoAttractions.length === 0) {
      console.log("⚠️  MongoDB 中没有景点数据，请先运行数据库初始化")
      return
    }

    // 转换为向量库格式（包含坐标信息）
    const attractions = mongoAttractions.map((attraction) => ({
      id: attraction.id,
      name: attraction.name,
      location: attraction.location,
      rating: attraction.rating,
      type: attraction.type,
      description: attraction.description,
      imageUrl: attraction.imageUrl,
      likes: attraction.likes || 0,
      // 传递坐标信息（如果存在）
      coordinate: attraction.coordinate ? {
        latitude: attraction.coordinate.latitude,
        longitude: attraction.coordinate.longitude,
        coordinateType: attraction.coordinate.coordinateType || 'BD09',
      } : undefined,
    }))

    // 批量添加到向量库
    await addAttractionsBatch(attractions, 5) // 小批次，避免 API 限制

    console.log("✅ 迁移完成！")
  } catch (error) {
    console.error("❌ 迁移失败:", error)
    throw error
  } finally {
    await closePool()
  }
}

migrateAttractions()
  .then(() => {
    console.log("✅ 脚本执行完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error)
    process.exit(1)
  })
