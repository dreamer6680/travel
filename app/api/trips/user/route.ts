import { NextResponse } from "next/server"
import { TripService } from "@/server/controllers"

const tripService = new TripService()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const results = await tripService.getTripsByUserId(userId)
    return NextResponse.json(results)
  } catch (error) {
    console.error("获取用户行程失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
