import { NextResponse } from "next/server"
import { getAIRecommendationFallbacks } from "@/lib/mock-data"
import { getMongoClient, isMongoConfigured } from "@/lib/db"

function normalizeMongoRecommendation(record: Record<string, unknown>, fallbackId: number) {
  const idCandidate = typeof record.id === "number" ? record.id : fallbackId

  return {
    id: idCandidate,
    name: String(record.name ?? record.title ?? "未命名推荐"),
    location: String(record.location ?? record.city ?? "待补充"),
    rating: Number(record.rating ?? 4.5),
    type: String(record.type ?? "个性化推荐"),
    description: String(record.description ?? record.reason ?? "基于偏好生成的推荐"),
    imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : "/placeholder.svg?height=200&width=300",
  }
}

export async function GET() {
  if (!isMongoConfigured()) {
    return NextResponse.json(getAIRecommendationFallbacks())
  }

  try {
    const client = await getMongoClient()
    const db = client.db("trip")
    const collection = db.collection("Recommendations")
    const results = await collection.find({}).limit(12).toArray()

    if (results.length === 0) {
      return NextResponse.json(getAIRecommendationFallbacks())
    }

    return NextResponse.json(results.map((item, index) => normalizeMongoRecommendation(item, index + 1000)))
  } catch (error) {
    console.error("获取 AI 推荐失败，已回退到本地数据:", error)
    return NextResponse.json(getAIRecommendationFallbacks())
  }
}
