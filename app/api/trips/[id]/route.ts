import { NextResponse } from "next/server"
import { TripService } from "@/server/controllers"
import { proxyJsonToPythonAgent } from "@/server/python-agent-client"

const tripService = new TripService()

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params

    const trip = await tripService.getTripById(tripId)

    if (!trip) {
      return NextResponse.json({ message: "行程未找到" }, { status: 404 })
    }

    try {
      const t = trip as any
      // 把缓存的路线段传给 Python，Python 直接注入，跳过 Amap API 调用
      const loc = await proxyJsonToPythonAgent("/v1/trips/locations", {
        method: "POST",
        body: JSON.stringify({ trip, routeSegments: t.routeSegments ?? {} }),
      })
      return NextResponse.json({
        ...trip,
        days: loc.days ?? trip.days,
        allLocations: loc.allLocations,
        selectedHotel: loc.selectedHotel,
        hotelNightlyCost: loc.hotelNightlyCost ?? t.hotelNightlyCost,
        hotelTotalCost: loc.hotelTotalCost ?? t.hotelTotalCost,
      })
    } catch {
      return NextResponse.json(trip)
    }
  } catch (error) {
    console.error("获取行程失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const updateData = await request.json()
    const { id: tripId } = await params
    const { updatedTrip } = await tripService.updateTrip(tripId, updateData)
    return NextResponse.json(updatedTrip)
  } catch (error) {
    console.error("更新行程失败:", error)
    return NextResponse.json({ message: "更新行程失败" }, { status: 500 })
  }
}
