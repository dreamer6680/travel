#!/usr/bin/env tsx
/**
 * 从 Mongo 读取景区/酒店/餐厅，向量化后写入 PostgreSQL(pgvector)
 * 表名：attractions / hotels / restaurants
 */
import "./load-env-local"
import clientPromise, { MONGODB_DB_NAME } from "../lib/db"
import { query, waitForDatabase } from "../lib/db-pg"

type AnyDoc = Record<string, any>

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://127.0.0.1:11434"
const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.map((v) => Number(v).toFixed(8)).join(",")}]`
}

async function embed(text: string): Promise<number[]> {
  let response: Response
  try {
    response = await fetch(`${OLLAMA_API_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_EMBEDDING_MODEL, prompt: text }),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      throw new Error(
        `无法连接 Ollama (${OLLAMA_API_URL})。请先执行 ollama serve 并 ollama pull ${OLLAMA_EMBEDDING_MODEL}，或先运行 pnpm ollama:wait。原始错误: ${msg}`
      )
    }
    throw e
  }
  if (!response.ok) {
    throw new Error(`Ollama embeddings 失败: ${response.status} ${await response.text()}`)
  }
  const data = await response.json()
  if (!Array.isArray(data.embedding)) throw new Error("embedding 响应格式错误")
  return data.embedding as number[]
}

function buildAttractionText(doc: AnyDoc) {
  return [
    doc.name || "",
    doc.location || "",
    doc.type || "",
    doc.description || "",
    doc.rating ? `评分:${doc.rating}` : "",
  ]
    .filter(Boolean)
    .join(". ")
}

function buildHotelText(doc: AnyDoc) {
  return [
    doc.hotelName || doc.name || "",
    doc.cityName || doc.location || "",
    doc.positionDesc || doc.position || "",
    doc.address || "",
    doc.score ? `评分:${doc.score}` : "",
    doc.price ? `价格:${doc.price}` : "",
  ]
    .filter(Boolean)
    .join(". ")
}

function buildRestaurantText(doc: AnyDoc) {
  return [
    doc.name || "",
    doc.location || "",
    doc.type || "",
    doc.description || "",
    doc.rating ? `评分:${doc.rating}` : "",
    doc.priceRange || doc.price_range ? `人均:${doc.priceRange || doc.price_range}` : "",
  ]
    .filter(Boolean)
    .join(". ")
}

async function upsertAttractionVector(doc: AnyDoc, embedding: number[]) {
  const attractionId = Number(doc.id || doc.attraction_id || Date.now())
  const latitude = doc.coordinate?.latitude ?? doc.latitude ?? null
  const longitude = doc.coordinate?.longitude ?? doc.longitude ?? null
  const coordType = doc.coordinate?.coordinateType || doc.coordinate_type || "BD09"
  const vector = toVectorLiteral(embedding)

  await query("DELETE FROM attractions WHERE attraction_id = $1", [attractionId])
  await query(
    `INSERT INTO attractions
      (attraction_id, name, location, rating, type, description, image_url, likes, latitude, longitude, coordinate_type, embedding, metadata)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::vector,$13::jsonb)`,
    [
      attractionId,
      String(doc.name || ""),
      String(doc.location || ""),
      Number(doc.rating || 0),
      String(doc.type || "景点"),
      String(doc.description || ""),
      String(doc.imageUrl || doc.image_url || ""),
      Number(doc.likes || 0),
      latitude != null ? Number(latitude) : null,
      longitude != null ? Number(longitude) : null,
      coordType,
      vector,
      JSON.stringify({ source: "mongo", collection: "Recomendations" }),
    ]
  )
}

async function upsertHotelVector(doc: AnyDoc, embedding: number[]) {
  const hotelId = String(doc.hotelId || doc.hotel_id || doc.id || "")
  const vector = toVectorLiteral(embedding)
  const lat = doc.latitude ?? doc.coordinate?.latitude ?? null
  const lng = doc.longitude ?? doc.coordinate?.longitude ?? null
  const rawZones = doc.zoneNames ?? doc.zone_names
  const zoneNamesPg: string[] = Array.isArray(rawZones)
    ? rawZones.map((x: unknown) => String(x))
    : rawZones != null && rawZones !== ""
      ? [String(rawZones)]
      : []

  await query("DELETE FROM hotels WHERE hotel_id = $1", [hotelId])
  await query(
    `INSERT INTO hotels
      (hotel_id, name, location, star, star_type, type, description, image_url, rating,
       comment_number, price_display, price_yuan, address, position_desc, zone_names,
       latitude, longitude, coordinate_type, rooms, embedding, metadata)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::vector,$21::jsonb)`,
    [
      hotelId,
      String(doc.hotelName || doc.name || ""),
      String(doc.cityName || doc.location || ""),
      Number(doc.star || 0),
      Number(doc.starType || doc.star_type || 0),
      "酒店",
      String(doc.commentDescription || doc.description || ""),
      String(doc.hotelImage || doc.imageUrl || ""),
      Number(doc.score || doc.rating || 0),
      String(doc.commentNumber || ""),
      String(doc.price || doc.priceDisplay || ""),
      Number((doc.price || "0").toString().replace(/[^\d.]/g, "") || 0),
      String(doc.address || ""),
      String(doc.positionDesc || doc.position || ""),
      zoneNamesPg,
      lat != null ? Number(lat) : null,
      lng != null ? Number(lng) : null,
      String(doc.coordinateType || "BD09"),
      JSON.stringify(doc.roomInfo || doc.rooms || []),
      vector,
      JSON.stringify({ source: "mongo", collection: "Hotels" }),
    ]
  )
}

async function upsertRestaurantVector(doc: AnyDoc, embedding: number[]) {
  const restaurantId = Number(doc.id || doc.restaurant_id || Date.now())
  const latitude = doc.coordinate?.latitude ?? doc.latitude ?? null
  const longitude = doc.coordinate?.longitude ?? doc.longitude ?? null
  const coordType = doc.coordinate?.coordinateType || doc.coordinate_type || "BD09"
  const vector = toVectorLiteral(embedding)

  await query("DELETE FROM restaurants WHERE restaurant_id = $1", [restaurantId])
  await query(
    `INSERT INTO restaurants
      (restaurant_id, name, location, rating, type, description, image_url, price_yuan,
       price_range, likes, latitude, longitude, coordinate_type, embedding, metadata)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::vector,$15::jsonb)`,
    [
      restaurantId,
      String(doc.name || ""),
      String(doc.location || ""),
      Number(doc.rating || 0),
      String(doc.type || "餐厅"),
      String(doc.description || ""),
      String(doc.imageUrl || doc.image_url || ""),
      Number(doc.priceYuan || doc.price_yuan || 0),
      String(doc.priceRange || doc.price_range || ""),
      Number(doc.likes || 0),
      latitude != null ? Number(latitude) : null,
      longitude != null ? Number(longitude) : null,
      coordType,
      vector,
      JSON.stringify({ source: "mongo", collection: "Restaurants" }),
    ]
  )
}

async function main() {
  await waitForDatabase()
  const mongo = await clientPromise
  const db = mongo.db(MONGODB_DB_NAME)

  const recs = await db.collection("Recomendations").find({}).limit(300).toArray()
  const restaurants = await db.collection("Restaurants").find({}).limit(300).toArray()
  const hotels = await db.collection("Hotels").find({}).limit(300).toArray()

  console.log(`📦 Mongo 数据: 景区=${recs.length}, 餐厅=${restaurants.length}, 酒店=${hotels.length}`)

  let doneAttractions = 0
  for (const doc of recs) {
    const emb = await embed(buildAttractionText(doc))
    await upsertAttractionVector(doc, emb)
    doneAttractions++
    if (doneAttractions % 20 === 0) console.log(`🔄 attractions 已处理 ${doneAttractions}`)
    await new Promise((r) => setTimeout(r, 80))
  }

  let doneRestaurants = 0
  for (const doc of restaurants) {
    const emb = await embed(buildRestaurantText(doc))
    await upsertRestaurantVector(doc, emb)
    doneRestaurants++
    if (doneRestaurants % 20 === 0) console.log(`🔄 restaurants 已处理 ${doneRestaurants}`)
    await new Promise((r) => setTimeout(r, 80))
  }

  let doneHotels = 0
  for (const doc of hotels) {
    const emb = await embed(buildHotelText(doc))
    await upsertHotelVector(doc, emb)
    doneHotels++
    if (doneHotels % 20 === 0) console.log(`🔄 hotels 已处理 ${doneHotels}`)
    await new Promise((r) => setTimeout(r, 80))
  }

  await mongo.close()
  console.log(`✅ 向量化完成: attractions=${doneAttractions}, restaurants=${doneRestaurants}, hotels=${doneHotels}`)
}

main().catch((e) => {
  console.error("❌ 向量化失败:", e)
  process.exit(1)
})
