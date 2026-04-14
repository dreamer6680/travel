import { NextResponse } from "next/server"
import { TripService } from "@/server/controllers"
import { proxyJsonToPythonAgent } from "@/server/python-agent-client"

const tripService = new TripService()

export async function POST(request: Request) {
  try {
    const tripData = await request.json()
    const trip = await proxyJsonToPythonAgent("/v1/trips/generate", {
      method: "POST",
      body: JSON.stringify(tripData),
    })
    return NextResponse.json(trip, { status: 201 })
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
    
    console.log("tripData", updatedTrip)
    return NextResponse.json(updatedTrip, { status: 200 })
  } catch (error) {
    console.error("更新行程失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}