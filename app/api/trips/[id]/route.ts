import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const tripId = params.id

  // 在实际应用中，这里会从数据库获取特定行程
  const trip = {
    id: tripId,
    destination: "东京",
    startDate: "2025-07-15",
    endDate: "2025-07-20",
    travelers: 2,
    budget: 12500,
    travelStyle: "balanced",
    highlights: ["东京塔", "浅草寺", "teamLab", "筑地市场", "银座"],
    days: [
      {
        day: 1,
        title: "浅草 & 晴空塔",
        activities: [
          {
            time: "09:00 - 11:00",
            title: "浅草寺",
            type: "景点",
            description: "东京最古老的寺庙，体验传统日本文化。可以在仲见世通购买纪念品和品尝小吃。",
          },
          {
            time: "11:30 - 13:00",
            title: "午餐：浅草寿司",
            type: "餐厅",
            description: "品尝正宗的日本寿司，位于浅草寺附近的人气餐厅。",
          },
          {
            time: "14:00 - 16:00",
            title: "东京晴空塔",
            type: "景点",
            description: "登上东京最高的观景台，俯瞰整个东京城市风光。",
          },
          {
            time: "16:30 - 18:30",
            title: "晴空塔购物中心",
            type: "购物",
            description: "在日本最大的购物中心之一享受购物体验。",
          },
          {
            time: "19:00 - 21:00",
            title: "晚餐：隅田川旁餐厅",
            type: "餐厅",
            description: "在隅田川旁享用晚餐，欣赏晴空塔的夜景。",
          },
        ],
      },
      // 其他天的行程...
    ],
    recommendations: [
      { name: "明治神宫", type: "文化景点" },
      { name: "六本木之丘", type: "购物 & 观景" },
      { name: "吉卜力美术馆", type: "博物馆" },
      { name: "东京迪士尼", type: "主题公园" },
      { name: "代官山", type: "时尚街区" },
      { name: "日本科学未来馆", type: "博物馆" },
    ],
    practicalInfo: {
      transportation: [
        { name: "地铁通行证", cost: 800, icon: "Train" },
        { name: "机场至市区", cost: 3000, icon: "Train" },
      ],
      accommodation: [
        { name: "新宿格兰贝尔酒店", cost: 1200, icon: "Hotel" },
        { name: "涩谷东急酒店", cost: 1500, icon: "Hotel" },
      ],
      tips: [
        "日本使用日元，建议提前兑换或在机场兑换",
        "大多数商店接受信用卡，但小店和部分餐厅可能只接受现金",
        "公共场所提供免费 WiFi，也可以租借随身 WiFi",
        "东京夏季炎热潮湿，建议携带防晒用品和轻便衣物",
        "日本非常注重垃圾分类，请遵循当地规定",
      ],
    },
  }

  return NextResponse.json(trip)
}
