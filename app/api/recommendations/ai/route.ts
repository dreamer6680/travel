import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // 在实际应用中，这里会从数据库获取数据，并根据用户偏好进行过滤
  const aiRecommendations = [
    {
      id: 13,
      name: "teamLab无界",
      location: "东京, 日本",
      rating: 4.9,
      type: "艺术展览",
      description: "沉浸式数字艺术体验",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 14,
      name: "卢浮宫",
      location: "巴黎, 法国",
      rating: 4.8,
      type: "博物馆",
      description: "世界最大的艺术博物馆",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 15,
      name: "天坛",
      location: "北京, 中国",
      rating: 4.7,
      type: "历史建筑",
      description: "明清皇帝祭天的场所",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 16,
      name: "中央公园",
      location: "纽约, 美国",
      rating: 4.6,
      type: "公园",
      description: "曼哈顿的绿色心脏",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 17,
      name: "泰特现代美术馆",
      location: "伦敦, 英国",
      rating: 4.5,
      type: "博物馆",
      description: "世界领先的现代艺术博物馆",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
    {
      id: 18,
      name: "皇家植物园",
      location: "悉尼, 澳大利亚",
      rating: 4.4,
      type: "公园",
      description: "澳大利亚最古老的植物园",
      imageUrl: "/placeholder.svg?height=200&width=300",
    },
  ]

  return NextResponse.json(aiRecommendations)
}
