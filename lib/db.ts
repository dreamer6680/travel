// lib/mongodb.ts
import { MongoClient } from "mongodb";

// const uri = "mongodb://root:r6pbm9mm@dbconn.sealoshzh.site:40906/?directConnection=true";
// 从环境变量读取数据库配置，默认使用 Docker 本地数据库
// 如果使用 Docker Compose 中的 MongoDB，默认需要认证
const MONGODB_URI = process.env.MONGODB_URI || 
  (process.env.MONGO_ROOT_USERNAME && process.env.MONGO_ROOT_PASSWORD
    ? `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@localhost:27017/?authSource=admin`
    : "mongodb://admin:password123@localhost:27017/?authSource=admin"); // Docker Compose 默认认证
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "trip";

// 生产环境安全检查：如果未设置环境变量，给出警告
if (process.env.NODE_ENV === "production" && !process.env.MONGODB_URI) {
  console.warn(
    "⚠️ 警告: 生产环境未设置 MONGODB_URI 环境变量，使用默认值可能不安全"
  );
}

// 验证 URI 格式（基本检查）
if (!MONGODB_URI.startsWith("mongodb://") && !MONGODB_URI.startsWith("mongodb+srv://")) {
  throw new Error(
    `无效的 MongoDB URI 格式: ${MONGODB_URI}. URI 必须以 mongodb:// 或 mongodb+srv:// 开头`
  );
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // 用于在开发模式下防止多次创建连接
  // @ts-ignore
  var _mongoClientPromise: Promise<MongoClient>;
}

if (!global._mongoClientPromise) {
  client = new MongoClient(MONGODB_URI);
  global._mongoClientPromise = client.connect();
}

clientPromise = global._mongoClientPromise;

export default clientPromise;
export { MONGODB_DB_NAME };
