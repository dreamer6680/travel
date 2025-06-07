import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // 在实际应用中，这里会从数据库获取数据
  const hiddenGems = [
    {
      id: 7,
      name: "中目黑樱花道",
      location: "东京, 日本",
      rating: 4.5,
      type: "自然景观",
      description: "春季樱花盛开的绝美步道",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 8,
      name: "蒙马特高地",
      location: "巴黎, 法国",
      rating: 4.4,
      type: "文化区",
      description: "艺术家聚集的浪漫街区",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 9,
      name: "798艺术区",
      location: "北京, 中国",
      rating: 4.3,
      type: "艺术区",
      description: "当代艺术和创意产业聚集地",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 10,
      name: "布鲁克林高线公园",
      location: "纽约, 美国",
      rating: 4.4,
      type: "公园",
      description: "废弃铁路改造的空中花园",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 11,
      name: "诺丁山",
      location: "伦敦, 英国",
      rating: 4.2,
      type: "街区",
      description: "色彩缤纷的维多利亚式房屋街区",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 12,
      name: "邦迪海滩",
      location: "悉尼, 澳大利亚",
      rating: 4.6,
      type: "海滩",
      description: "世界著名的冲浪海滩",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
  ]

  return NextResponse.json(hiddenGems)
}
