import { NextResponse } from "next/server"
import { TripService, NotificationService } from "@/server/controllers"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

const tripService = new TripService()
const notifSvc = new NotificationService()

export async function POST(request: Request) {
  try {
    const authResult = await authenticateRequest(request as any)
    if (!authResult.authenticated) return authResult.response!

    const user = authResult.user!
    const userId = String(user.id)
    const tripData = await request.json()

    // 1. 立即保存骨架行程，返回 id
    const tripId = await tripService.savePendingTrip(tripData, userId)

    // 2. 在后台异步调用 Python Agent（不 await，不阻塞响应）
    Promise.resolve().then(async () => {
      try {
        const result = await tripService.generateWithAI(tripData)
        await tripService.finalizeTripGeneration(tripId, result)
        await notifSvc.create({
          userId,
          type: "trip_complete",
          title: "行程规划完成 🗺️",
          body: `前往${tripData.destination || "目的地"}的行程已生成，快去查看吧！`,
          link: `/trip/detail?id=${tripId}`,
        })
      } catch (err) {
        console.error("后台行程生成失败:", err)
        await tripService.markTripFailed(tripId).catch(() => {})
        await notifSvc.create({
          userId,
          type: "trip_complete",
          title: "行程规划失败",
          body: `前往${tripData.destination || "目的地"}的行程生成失败，请重新尝试`,
          link: `/trips`,
        }).catch(() => {})
      }
    })

    // 3. 立即返回，前端无需等待
    return NextResponse.json({ id: tripId, status: "generating" }, { status: 201 })
  } catch (error) {
    console.error("创建行程失败:", error)
    return NextResponse.json({ message: "创建行程失败" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const trips = await tripService.getAllTrips()
    return NextResponse.json(trips)
  } catch (error) {
    console.error("获取行程失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const tripData = await request.json()
    const { result, updatedTrip } = await tripService.confirmTrip(tripData)

    if (result.modifiedCount === 0 && result.matchedCount === 0) {
      return NextResponse.json({ message: "更新行程失败" }, { status: 500 })
    }

    return NextResponse.json(updatedTrip, { status: 200 })
  } catch (error) {
    console.error("更新行程失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
