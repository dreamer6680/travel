import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // 在实际应用中，这里会从数据库获取数据
  const popularAttractions = [
    {
      id: 1,
      name: "东京塔",
      location: "东京, 日本",
      rating: 4.7,
      type: "观景台",
      description: "东京的标志性建筑，可俯瞰整个城市",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 2,
      name: "巴黎铁塔",
      location: "巴黎, 法国",
      rating: 4.8,
      type: "观景台",
      description: "法国最著名的地标建筑",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 3,
      name: "大峡谷",
      location: "亚利桑那, 美国",
      rating: 4.9,
      type: "自然景观",
      description: "世界七大自然奇观之一",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 4,
      name: "故宫",
      location: "北京, 中国",
      rating: 4.8,
      type: "历史建筑",
      description: "中国明清两代的皇家宫殿",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 5,
      name: "大英博物馆",
      location: "伦敦, 英国",
      rating: 4.7,
      type: "博物馆",
      description: "世界上历史最悠久的博物馆之一",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 6,
      name: "悉尼歌剧院",
      location: "悉尼, 澳大利亚",
      rating: 4.6,
      type: "建筑",
      description: "世界著名的表演艺术中心",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
  ]

  return NextResponse.json(popularAttractions)
}
