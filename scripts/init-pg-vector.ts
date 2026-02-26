#!/usr/bin/env tsx
/**
 * 初始化 PostgreSQL + pgvector 数据库
 */

import { query, initPgVector } from "../lib/db-pg"
import { closePool } from "../lib/db-pg"

async function initDatabase() {
  try {
    console.log("🚀 开始初始化 PostgreSQL + pgvector...")

    // 启用 pgvector 扩展
    await initPgVector()

    // 检查表是否存在
    const tablesCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('attraction_vectors', 'user_preference_vectors')
    `)

    if (tablesCheck.rows.length === 2) {
      console.log("✅ 表已存在，跳过创建")
    } else {
      console.log("📝 创建表结构...")
      // 表结构已在 SQL 文件中定义，这里只做验证
      const tableCheck = await query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'attraction_vectors'
      `)

      if (tableCheck.rows[0].count === "0") {
        console.log("⚠️  表不存在，请确保 docker-compose.yml 中的初始化脚本已执行")
        console.log("   或者手动运行 SQL 文件: scripts/init-pg-vector.sql")
      }
    }

    // 验证 pgvector 扩展
    const extensionCheck = await query(`
      SELECT * FROM pg_extension WHERE extname = 'vector'
    `)

    if (extensionCheck.rows.length > 0) {
      console.log("✅ pgvector 扩展已安装")
    } else {
      throw new Error("pgvector 扩展未安装")
    }

    console.log("✅ PostgreSQL + pgvector 初始化完成！")
  } catch (error) {
    console.error("❌ 初始化失败:", error)
    throw error
  } finally {
    await closePool()
  }
}

initDatabase()
  .then(() => {
    console.log("✅ 脚本执行完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error)
    process.exit(1)
  })
