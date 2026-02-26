import clientPromise from "@/lib/db"

export class RecommendationService {
  /**
   * 获取热门景点（likes > 300）
   */
  async getPopularAttractions() {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("Recomendations")
    return await collection.find({ likes: { $gt: 300 } }).sort({ likes: -1 }).toArray()
  }

  /**
   * 获取隐藏景点（likes < 300）
   */
  async getHiddenGems() {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("Recomendations")
    return await collection.find({ likes: { $lt: 300 } }).sort({ rating: -1 }).toArray()
  }

  /**
   * 获取所有推荐（AI 推荐）
   */
  async getAIRecommendations() {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("Recomendations")
    return await collection.find({}).toArray()
  }
}

