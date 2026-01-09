import clientPromise from "@/lib/db"

export class TripService {
  /**
   * 获取所有行程（临时数据，实际应从数据库获取）
   */
  async getAllTrips() {
    // TODO: 从数据库获取
    return [
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
  }

  /**
   * 根据用户 ID 获取行程
   */
  async getTripsByUserId(userId: string) {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("Trips")
    return await collection.find({ userId }).toArray()
  }

  /**
   * 根据 ID 获取行程
   */
  async getTripById(id: number) {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("Trips")
    return await collection.findOne({ id })
  }

  /**
   * 创建行程（使用 AI 生成）
   */
  async createTripWithAI(tripData: any) {
    const messages = `你是一位专业的旅游行程设计师，请根据以下用户需求，生成一份详细而实用的旅游行程规划。请综合考虑目的地的特色、美食、购物、交通和住宿等要素，并严格按照给定的 JSON 模板格式输出。

请确保内容包括：
- 每日行程的合理安排（按日期划分）
- 每天不少于 2 个活动，明确时间段和类型
- 推荐景点和活动必须与旅行风格和兴趣偏好一致
- 提供实用的交通、住宿建议
- 至少 3 条旅行小贴士，结合当地特色
- 不要省略任何字段，字段顺序和结构必须与模板一致
- 所有字段请填写具体、真实、有吸引力的内容
- 不可以省略任何字段
- 不可以省略任何字段
- 不可以省略任何字段

---

🧾 用户需求如下：
目的地：${tripData.destination}  
出发日期：${tripData.startDate}  
结束日期：${tripData.endDate}  
旅行人数：${tripData.travelers}  
预算：${tripData.budget}元  
旅行风格：${tripData.travelStyle}  
兴趣偏好：${tripData.interests}

---

📦 请使用以下 JSON 模板格式输出，字段说明仅供参考，不要原样复制，请替换为具体内容：

{
  "title": "例如：${tripData.destination}畅享美食与购物之旅",
  "destination": "${tripData.destination}",
  "startDate": "${tripData.startDate}",
  "endDate": "${tripData.endDate}",
  "travelers": ${tripData.travelers},
  "budget": ${tripData.budget},
  "travelStyle": "${tripData.travelStyle}",
  "status": "confirmed",
  "highlights": ["请列出至少 4 个${tripData.destination}的代表性景点或体验，如地标、美食街、特色市集等"],
  "days": [
    {
      "day": 1,
      "title": "例如：抵达${tripData.destination}，开启购物与美食之旅",
      "activities": [
        {
          "time": "上午",
          "title": "前往XXX市场",
          "type": "购物",
          "description": "探索当地特色商品，体验地道市井风情"
        },
        {
          "time": "下午",
          "title": "品尝地道美食",
          "type": "餐厅",
          "description": "享用当地知名餐厅的招牌菜"
        }
      ]
    }
  ],
  "recommendations": [
    { "name": "某某夜市", "type": "美食" },
    { "name": "某某百货商场", "type": "购物" }
  ],
  "practicalInfo": {
    "transportation": [
      { "name": "地铁", "cost": 100, "icon": "Train" },
      { "name": "出租车", "cost": 300, "icon": "Taxi" }
    ],
    "accommodation": [
      { "name": "XX精品酒店", "cost": 1200, "icon": "Hotel" }
    ],
    "tips": [
      "建议使用地铁出行，避免交通拥堵",
      "提前预约热门餐厅，避免排队",
      "留意景区开放时间，合理安排行程"
    ]
  },
  "createdAt": "${new Date().toISOString()}",
  "updatedAt": "${new Date().toISOString()}"
}
    `

    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      body: JSON.stringify({
        model: "gemma3",
        prompt: messages,
        stream: false,
      }),
    })

    const data = await response.json()
    const pureJson = data.response
      .replace(/^```json\s*/, "") // 去掉开头的 ```json
      .replace(/\s*```$/, "") // 去掉结尾的 ```

    const parsed = JSON.parse(pureJson)
    const trip = {
      ...parsed,
      id: Math.random().toString(36).substring(2, 15),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return trip
  }

  /**
   * 更新行程
   */
  async updateTrip(id: string, updateData: any) {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("Trips")
    const result = await collection.updateOne({ id }, { $set: updateData })
    return { result, updatedTrip: { ...updateData, id, updatedAt: new Date().toISOString() } }
  }

  /**
   * 确认行程
   */
  async confirmTrip(tripData: any) {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("Trips")
    const updatedTrip = {
      ...tripData,
      updatedAt: new Date().toISOString(),
    }
    const result = await collection.updateOne({ id: tripData.id }, { $set: updatedTrip })
    return { result, updatedTrip }
  }
}

