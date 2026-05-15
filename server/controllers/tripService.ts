import clientPromise from "@/lib/db"
import { randomUUID } from "crypto"
import { proxyJsonToPythonAgent } from "@/server/python-agent-client"
import { UserService } from "./userService"

export class TripService {
  private userService = new UserService()

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
  async generateWithAI(tripData: any, userId?: string) {
    const profile = userId ? await this.userService.getUserProfile(userId).catch(() => null) : null
    const preferences = profile?.preferences
    const mergedTripData = preferences
      ? {
          ...tripData,
          userId,
          userPreferences: preferences,
          budget: tripData.budget ?? preferences.budget,
          travelStyle: tripData.travelStyle ?? preferences.travelStyle,
          interests: tripData.interests || (preferences.interests ?? []).join("，"),
        }
      : tripData

    return proxyJsonToPythonAgent("/v1/trips/generate", {
      method: "POST",
      body: JSON.stringify(mergedTripData),
    })
  }

  /**
   * 将后台生成结果写入数据库，初始置为草稿状态。
   * 然后做一次临时 enrichment（坐标解析 + Amap 路线规划），
   * 只把高德路线结果（routeSegments）写回 Mongo，activities 不变（仍只含 from+id）。
   */
  async finalizeTripGeneration(id: string, result: any) {
    const col = await this.col()
    const existing = await col.findOne({ id })
    await col.updateOne(
      { id },
      {
        $set: {
          ...result,
          id,
          userId: existing?.userId,
          status: "draft",
          updatedAt: new Date().toISOString(),
        },
      }
    )

    // 临时 enrichment：坐标解析 + Amap 路线规划，只保存路线结果
    try {
      const enriched = await proxyJsonToPythonAgent("/v1/trips/locations", {
        method: "POST",
        body: JSON.stringify({ trip: { ...result, id } }),
      })
      // 从每天的 transitSegments 提取路线结果，按天号（字符串）索引
      const routeSegments: Record<string, any[]> = {}
      for (const day of (enriched.days ?? [])) {
        if (day.transitSegments?.length) {
          routeSegments[String(day.day)] = day.transitSegments.map((s: any) => ({
            fromIndex: s.fromIndex,
            toIndex: s.toIndex,
            route: s.route,
          }))
        }
      }
      if (Object.keys(routeSegments).length > 0) {
        await col.updateOne({ id }, { $set: { routeSegments } })
        console.log("[TripService] routeSegments 已写入", {
          tripId: id,
          dayKeys: Object.keys(routeSegments),
          counts: Object.fromEntries(
            Object.entries(routeSegments).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
          ),
        })
      } else {
        const perDay = (enriched.days ?? []).map((d: any) => ({
          day: d.day,
          segCount: d.transitSegments?.length ?? 0,
        }))
        console.warn(
          "[TripService] 未写入 routeSegments：Python 返回的 days 中无 transitSegments。请查看 Agent 日志（AMAP_WEB_SERVICE_KEY、高德 status/infocode）",
          { tripId: id, perDay }
        )
      }
    } catch (e) {
      console.warn("[TripService] post-generation route caching failed:", e)
    }
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
   * 确认行程，将状态设置为 "confirmed"
   */
  async confirmTrip(tripData: any) {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("Trips")
    // 去掉 MongoDB 内部字段 _id，避免 $set 时报错
    const { _id, ...safeData } = tripData
    const updatedTrip = {
      ...safeData,
      status: "confirmed",
      updatedAt: new Date().toISOString(),
    }
    const result = await collection.updateOne({ id: tripData.id }, { $set: updatedTrip })
    return { result, updatedTrip }
  }
}

