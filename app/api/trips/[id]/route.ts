import { NextResponse } from "next/server"
import { deleteTrip, getTripById, updateTrip } from "@/lib/mock-data"

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>
}

async function resolveTripId(context: RouteContext) {
  const params = await context.params
  return params.id
}

export async function GET(_request: Request, context: RouteContext) {
  const tripId = await resolveTripId(context)
  const trip = getTripById(tripId)

  if (!trip) {
    return NextResponse.json({ message: "未找到对应行程" }, { status: 404 })
  }

  return NextResponse.json(trip)
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const tripId = await resolveTripId(context)
    const updates = await request.json()
    const trip = updateTrip(tripId, updates)

    if (!trip) {
      return NextResponse.json({ message: "未找到对应行程" }, { status: 404 })
    }

    return NextResponse.json(trip)
  } catch (error) {
    console.error("更新行程失败:", error)
    return NextResponse.json({ message: "更新行程失败" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const tripId = await resolveTripId(context)
  const deleted = deleteTrip(tripId)

  if (!deleted) {
    return NextResponse.json({ message: "未找到对应行程" }, { status: 404 })
  }

  return NextResponse.json({ message: "行程已删除" })
}
