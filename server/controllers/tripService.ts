import clientPromise from "@/lib/db"
import { randomUUID } from "crypto"
import { proxyJsonToPythonAgent } from "@/server/python-agent-client"

export class TripService {
  private col() {
    return clientPromise.then((c) => c.db("trip").collection("Trips"))
  }

  async getAllTrips() {
    const col = await this.col()
    return col.find({}).sort({ createdAt: -1 }).toArray()
  }

  async getTripsByUserId(userId: string) {
    const col = await this.col()
    return col.find({ userId }).sort({ createdAt: -1 }).toArray()
  }

  async getTripById(id: string) {
    const col = await this.col()
    return col.findOne({ id })
  }

  /**
   * 立即保存行程骨架（status: "generating"），返回 id
   */
  async savePendingTrip(tripData: any, userId: string): Promise<string> {
    const col = await this.col()
    const id = randomUUID()
    await col.insertOne({
      id,
      userId,
      ...tripData,
      status: "generating",
      highlights: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return id
  }

  /**
   * 调用 Python Agent 生成行程（阻塞，供后台任务使用）
   */
  async generateWithAI(tripData: any) {
    return proxyJsonToPythonAgent("/v1/trips/generate", {
      method: "POST",
      body: JSON.stringify(tripData),
    })
  }

  /**
   * 将后台生成结果写入数据库
   */
  async finalizeTripGeneration(id: string, result: any) {
    const col = await this.col()
    return col.updateOne(
      { id },
      {
        $set: {
          ...result,
          id, // 保持 id 不变
          status: "planning",
          updatedAt: new Date().toISOString(),
        },
      }
    )
  }

  /**
   * 标记生成失败
   */
  async markTripFailed(id: string) {
    const col = await this.col()
    return col.updateOne(
      { id },
      { $set: { status: "failed", updatedAt: new Date().toISOString() } }
    )
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

