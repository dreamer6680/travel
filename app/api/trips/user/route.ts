import { NextResponse } from "next/server"
import { TripService } from "@/server/controllers"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

const tripService = new TripService()

export async function GET(request: Request) {
  try {
    const authResult = await authenticateRequest(request as any)
    if (!authResult.authenticated) return authResult.response!

    const userId = String(authResult.user!.id)
    const results = await tripService.getTripsByUserId(userId)
    return NextResponse.json(results)
  } catch (error) {
    console.error("获取用户行程失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
