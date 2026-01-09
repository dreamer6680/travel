import { NextResponse } from "next/server"
import { RecommendationService } from "@/server/controllers"

const recommendationService = new RecommendationService()

export async function GET(request: Request) {
  try {
    const results = await recommendationService.getHiddenGems()
    return NextResponse.json(results)
  } catch (error) {
    console.error("获取隐藏景点失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
