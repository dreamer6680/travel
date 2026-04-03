import { getMongoClient, isMongoConfigured } from "./db"

export async function initDatabase() {
  if (!isMongoConfigured()) {
    console.warn("跳过数据库初始化：未配置 MONGODB_URI")
    return
  }

  const client = await getMongoClient()
  const db = client.db("trip")
  const collections = await db.listCollections().toArray()

  console.log(`✅ Database is ready. Existing collections: ${collections.length}`)
}
