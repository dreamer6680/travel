import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const tripData = await request.json()

    // 在实际应用中，这里会将数据保存到数据库
    // 这里我们模拟创建一个新的行程并返回
    const newTrip = {
      id: Math.random().toString(36).substring(2, 15),
      ...tripData,
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json(newTrip, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: "创建行程失败" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  // 在实际应用中，这里会从数据库获取用户的行程
  const trips = [
    {
      id: "trip1",
      destination: "东京",
      startDate: "2025-07-15",
      endDate: "2025-07-20",
      travelers: 2,
      budget: 12500,
      travelStyle: "balanced",
      highlights: ["东京塔", "浅草寺", "teamLab", "筑地市场", "银座"],
    },
    {
      id: "trip2",
      destination: "巴黎",
      startDate: "2025-09-10",
      endDate: "2025-09-17",
      travelers: 2,
      budget: 15000,
      travelStyle: "cultural",
      highlights: ["埃菲尔铁塔", "卢浮宫", "凯旋门", "蒙马特高地", "塞纳河"],
    },
  ]

  return NextResponse.json(trips)
}
