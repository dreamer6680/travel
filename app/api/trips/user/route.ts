import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // 在实际应用中，这里会从数据库获取用户的所有行程
  const userTrips = [
    {
      id: "trip1",
      title: "东京 5 日游",
      destination: "东京, 日本",
      startDate: "2025-07-15",
      endDate: "2025-07-20",
      travelers: 2,
      budget: 12500,
      status: "confirmed",
      highlights: ["东京塔", "浅草寺", "teamLab", "筑地市场"],
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-02T00:00:00Z",
    },
    {
      id: "trip2",
      title: "巴黎浪漫之旅",
      destination: "巴黎, 法国",
      startDate: "2025-09-10",
      endDate: "2025-09-17",
      travelers: 2,
      budget: 15000,
      status: "draft",
      highlights: ["埃菲尔铁塔", "卢浮宫", "凯旋门", "蒙马特高地"],
      createdAt: "2025-01-03T00:00:00Z",
      updatedAt: "2025-01-03T00:00:00Z",
    },
    {
      id: "trip3",
      title: "纽约城市探索",
      destination: "纽约, 美国",
      startDate: "2024-12-01",
      endDate: "2024-12-07",
      travelers: 1,
      budget: 18000,
      status: "completed",
      highlights: ["自由女神像", "中央公园", "时代广场", "布鲁克林大桥"],
      createdAt: "2024-11-01T00:00:00Z",
      updatedAt: "2024-12-08T00:00:00Z",
    },
    {
      id: "trip4",
      title: "京都文化体验",
      destination: "京都, 日本",
      startDate: "2025-04-01",
      endDate: "2025-04-05",
      travelers: 3,
      budget: 8000,
      status: "planning",
      highlights: ["清水寺", "金阁寺", "伏见稻荷大社", "岚山"],
      createdAt: "2025-01-05T00:00:00Z",
      updatedAt: "2025-01-06T00:00:00Z",
    },
  ]

  return NextResponse.json(userTrips)
}
