// @ts-ignore - pg 类型定义
import { Pool, PoolClient } from "pg"

// 从环境变量读取 PostgreSQL 配置
const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  `postgresql://${process.env.POSTGRES_USER || "postgres"}:${process.env.POSTGRES_PASSWORD || "postgres123"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "travel_vectors"}`

// 生产环境安全检查
if (process.env.NODE_ENV === "production" && !process.env.POSTGRES_URL) {
  console.warn(
    "⚠️ 警告: 生产环境未设置 POSTGRES_URL 环境变量，使用默认值可能不安全"
  )
}

// 创建连接池
let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: POSTGRES_URL,
      max: 20, // 最大连接数
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // 增加到 10 秒，给 Docker 容器更多启动时间
    })

    // 错误处理
    pool.on("error", (err: Error) => {
      console.error("PostgreSQL 连接池错误:", err)
    })
  }

  return pool
}

/**
 * 获取 PostgreSQL 连接池
 */
export function getPostgresPool(): Pool {
  return getPool()
}

/**
 * 执行查询
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool()
  const start = Date.now()
  try {
    const result = await pool.query(text, params)
    const duration = Date.now() - start
    console.log("执行查询", { text, duration, rows: result.rowCount })
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
    }
  } catch (error) {
    console.error("查询错误", { text, error })
    throw error
  }
}

/**
 * 获取客户端（用于事务）
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool()
  return await pool.connect()
}

/**
 * 等待数据库连接就绪
 * @param maxRetries 最大重试次数
 * @param retryDelay 重试延迟（毫秒）
 */
export async function waitForDatabase(
  maxRetries: number = 30,
  retryDelay: number = 1000
): Promise<void> {
  const pool = getPool()
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await pool.query("SELECT 1")
      if (result.rows.length > 0) {
        console.log("✅ PostgreSQL 数据库连接成功")
        return
      }
    } catch (error) {
      if (i < maxRetries - 1) {
        console.log(`⏳ 等待 PostgreSQL 数据库就绪... (${i + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      } else {
        throw new Error(
          `PostgreSQL 数据库连接失败，已重试 ${maxRetries} 次: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    }
  }
}

/**
 * 初始化 pgvector 扩展
 */
export async function initPgVector(): Promise<void> {
  try {
    // 先等待数据库就绪
    await waitForDatabase()
    
    await query("CREATE EXTENSION IF NOT EXISTS vector")
    console.log("✅ pgvector 扩展已启用")
  } catch (error) {
    console.error("❌ 启用 pgvector 扩展失败:", error)
    throw error
  }
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

// 在开发模式下，确保连接池在应用关闭时正确关闭
if (typeof process !== "undefined") {
  process.on("SIGINT", async () => {
    await closePool()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    await closePool()
    process.exit(0)
  })
}

export default getPool
