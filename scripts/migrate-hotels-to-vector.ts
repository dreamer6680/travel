#!/usr/bin/env tsx
/**
 * 从 MongoDB Hotels 迁移酒店数据到 PostgreSQL hotel_vectors
 * 先确保：1) 已运行 scrape-ctrip-hotels 写入 Mongo  2) 已执行 init-pg-vector.sql 或包含 hotel_vectors 的初始化
 */

import clientPromise from "../lib/db"
import { MONGODB_DB_NAME } from "../lib/db"
import { addHotelsBatch, type Hotel } from "../lib/services/knowledge-base-service"
import { initPgVector, closePool } from "../lib/db-pg"

interface MongoHotel {
  hotelId: string
  hotelName: string
  enName?: string
  star: number
  starType?: number
  hotelImage?: string
  detailUrl?: string
  score?: string
  commentNumber?: string
  commentDescription?: string
  fullRating?: string
  price?: string
  priceDelete?: string
  soldOut?: boolean
  position?: string
  cityId: number
  cityName?: string
  address?: string
  positionDesc?: string
  zoneNames?: string[]
  latitude?: number
  longitude?: number
  coordinateType?: string
  roomInfo?: Array<{
    roomName: string
    roomId?: string
    price?: number
    priceDisplay?: string
    deleteDisplayPrice?: string
    bedSummary?: string
  }>
  scrapedAt?: string
}

function parsePriceYuan(s: string): number | undefined {
  if (!s || typeof s !== "string") return undefined
  const num = parseFloat(s.replace(/[¥¥,\s]/g, ""))
  return isNaN(num) ? undefined : num
}

async function migrate() {
  console.log("🚀 开始迁移酒店数据到向量库...")

  await initPgVector()

  const client = await clientPromise
  const db = client.db(MONGODB_DB_NAME)
  const coll = db.collection<MongoHotel>("Hotels")

  const mongoHotels = await coll.find({}).toArray()
  console.log(`✅ 从 MongoDB 读取到 ${mongoHotels.length} 条酒店`)

  if (mongoHotels.length === 0) {
    console.log("⚠️  MongoDB 中没有酒店数据，请先运行: npx tsx scripts/scrape-ctrip-hotels.ts [cityId]")
    return
  }

  const hotels: Hotel[] = mongoHotels.map((h) => ({
    hotelId: h.hotelId,
    name: h.hotelName,
    location: h.cityName ?? h.positionDesc ?? `城市${h.cityId}`,
    star: h.star ?? 0,
    starType: h.starType,
    description: h.commentDescription,
    imageUrl: h.hotelImage,
    score: h.score,
    commentNumber: h.commentNumber,
    priceDisplay: h.price,
    priceYuan: h.price ? parsePriceYuan(h.price) : undefined,
    address: h.address,
    positionDesc: h.positionDesc,
    zoneNames: h.zoneNames,
    latitude: h.latitude,
    longitude: h.longitude,
    coordinateType: h.coordinateType,
    roomInfo: h.roomInfo,
  }))

  await addHotelsBatch(hotels, 5)
  console.log("✅ 酒店向量迁移完成")
}

migrate()
  .then(() => {
    console.log("✅ 脚本执行完成")
    process.exit(0)
  })
  .catch((e) => {
    console.error("❌ 脚本执行失败:", e)
    process.exit(1)
  })
  .finally(() => {
    closePool()
  })
