import clientPromise from "@/lib/db"
import { proxyJsonToPythonAgent } from "@/server/python-agent-client"

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
   * 创建行程（由 Python Agent 生成）
   */
  async createTripWithAI(tripData: any) {
    return proxyJsonToPythonAgent("/v1/trips/generate", {
      method: "POST",
      body: JSON.stringify(tripData),
    })
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

