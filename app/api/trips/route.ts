import { NextResponse } from "next/server"
import { createTrip, getTrips } from "@/lib/mock-data"

export async function POST(request: Request) {
  try {
    const tripData = await request.json()

    if (!tripData.destination || !tripData.startDate) {
      return NextResponse.json({ message: "目的地和出发日期不能为空" }, { status: 400 })
    }

    const newTrip = createTrip({
      destination: tripData.destination,
      startDate: tripData.startDate,
      endDate: tripData.endDate,
      travelers: Number(tripData.travelers) || 1,
      budget: Number(tripData.budget) || 0,
      travelStyle: tripData.travelStyle || "balanced",
      interests: tripData.interests,
    })

    return NextResponse.json(newTrip, { status: 201 })
  } catch (error) {
    console.error("创建行程失败:", error)
    return NextResponse.json({ message: "创建行程失败" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json(getTrips())
}
