import { NextResponse } from "next/server"
import { proxyJsonToPythonAgent } from "@/server/python-agent-client"

/**
 * POST /api/trips/locations
 * 获取行程所有地点的坐标
 * 
 * 请求体：
 * {
 *   trip: {
 *     destination: string
 *     days: Array<{...}>
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { trip } = body

    if (!trip || !trip.destination || !trip.days) {
      return NextResponse.json(
        { error: "无效的行程数据" },
        { status: 400 }
      )
    }

    const tripWithLocations = await proxyJsonToPythonAgent("/v1/trips/locations", {
      method: "POST",
      body: JSON.stringify({ trip }),
    })

    return NextResponse.json(tripWithLocations, { status: 200 })
  } catch (error) {
    console.error("获取行程地点失败:", error)
    return NextResponse.json(
      { error: "获取行程地点失败" },
      { status: 500 }
    )
  }
}
