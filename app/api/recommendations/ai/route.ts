import { NextResponse } from "next/server"
import { RecommendationService } from "@/server/controllers"

const recommendationService = new RecommendationService()

export async function GET(request: Request) {
  try {
    const results = await recommendationService.getAIRecommendations()
    return NextResponse.json(results)
  } catch (error) {
    console.error("❌ Failed to fetch recommendations:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
