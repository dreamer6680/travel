import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // 在实际应用中，这里会从数据库获取用户信息
  const userProfile = {
    id: "user1",
    name: "张三",
    email: "zhangsan@example.com",
    avatar: "/placeholder.svg?height=100&width=100",
    phone: "+86 138 0013 8000",
    location: "北京, 中国",
    bio: "热爱旅行的探索者，喜欢发现世界各地的美景和文化。",
    joinDate: "2024-01-15T00:00:00Z",
    preferences: {
      budget: 10000,
      travelStyle: "balanced",
      favoriteDestinations: ["东京", "巴黎", "纽约"],
      interests: ["文化", "美食", "购物", "自然"],
      seasons: ["春季", "秋季"],
      accommodationType: "hotel",
      transportationPreference: "public",
    },
    settings: {
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      privacy: {
        profileVisible: true,
        tripsVisible: false,
      },
      language: "zh-CN",
      currency: "CNY",
    },
    stats: {
      totalTrips: 12,
      countriesVisited: 8,
      totalDistance: 45000,
      favoriteDestination: "东京",
    },
  }

  return NextResponse.json(userProfile)
}

export async function PUT(request: Request) {
  try {
    const userData = await request.json()

    // 在实际应用中，这里会更新数据库中的用户信息
    console.log("更新用户信息:", userData)

    return NextResponse.json({ message: "用户信息更新成功" })
  } catch (error) {
    return NextResponse.json({ message: "更新用户信息失败" }, { status: 500 })
  }
}
