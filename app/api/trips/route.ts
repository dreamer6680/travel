import { NextResponse } from "next/server"

// 简单的内存存储（实际应用中应该使用数据库）
const tripStorage = new Map<string, any>()

export async function POST(request: Request) {
  try {
    const tripData = await request.json()

    // 生成唯一 ID
    const tripId = Math.random().toString(36).substring(2, 15)
    
    // 保存行程数据
    tripStorage.set(tripId, {
      id: tripId,
      ...tripData,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({
      id: tripId,
      destination: tripData.destination,
      ...tripData,
      createdAt: new Date().toISOString(),
    }, { status: 201 })
  } catch (error) {
    console.error("创建行程失败:", error)
    return NextResponse.json({ message: "创建行程失败" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  // 返回所有行程
  const trips = Array.from(tripStorage.values())
  return NextResponse.json(trips)
}
