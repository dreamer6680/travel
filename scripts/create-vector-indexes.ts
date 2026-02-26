#!/usr/bin/env tsx
/**
 * 创建向量索引（需要在有数据后执行）
 * 因为 HNSW 索引需要知道向量维度
 */

import { query, waitForDatabase, closePool } from "../lib/db-pg"

async function getVectorColumnType(tableName: string, columnName: string) {
  const res = await query<{
    full_type: string
  }>(`
    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) as full_type
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = $1
      AND a.attname = $2
      AND NOT a.attisdropped
      AND a.attnum > 0
  `, [tableName, columnName])

  return res.rows[0]?.full_type ?? null
}

async function createVectorIndexes() {
  try {
    console.log("🚀 开始创建向量索引...")

    // 等待数据库就绪
    await waitForDatabase()

    // 检查表是否有数据
    const attractionCount = await query(
      "SELECT COUNT(*) as count FROM attraction_vectors WHERE embedding IS NOT NULL"
    )
    const userPrefCount = await query(
      "SELECT COUNT(*) as count FROM user_preference_vectors WHERE embedding IS NOT NULL"
    )

    const hasAttractionData = parseInt(attractionCount.rows[0].count) > 0
    const hasUserPrefData = parseInt(userPrefCount.rows[0].count) > 0

    if (!hasAttractionData && !hasUserPrefData) {
      console.log("⚠️  表中没有向量数据，无法创建索引")
      console.log("   请先运行 pnpm run pg:migrate 迁移数据，或插入一些向量数据")
      return
    }

    // 创建景点向量索引
    if (hasAttractionData) {
      try {
        const colType = await getVectorColumnType("attraction_vectors", "embedding")
        if (!colType) {
          console.log("⚠️  未找到 attraction_vectors.embedding 列，跳过索引创建")
        } else if (!/^vector\(\d+\)$/.test(colType)) {
          console.log(
            `⚠️  attraction_vectors.embedding 列类型为 ${colType}（无固定维度），pgvector 无法创建 HNSW/IVFFLAT 索引`
          )
          console.log(
            "   解决方案：必须改成 vector(768) 或 vector(1536) 这种固定维度；或拆成两张表/两列分别存不同维度"
          )
        } else {
        // 检查索引是否已存在
        const indexCheck = await query(`
          SELECT EXISTS (
            SELECT FROM pg_indexes 
            WHERE tablename = 'attraction_vectors' 
            AND indexname = 'attraction_vectors_embedding_idx'
          )
        `)

        if (!indexCheck.rows[0].exists) {
          console.log(`📝 创建景点向量索引（列类型: ${colType}）...`)
          await query(`
            CREATE INDEX attraction_vectors_embedding_idx 
            ON attraction_vectors 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
          `)
          console.log("✅ 景点向量索引创建完成（HNSW）")
        } else {
          console.log("ℹ️  景点向量索引已存在，跳过")
        }
        }
      } catch (error: any) {
        if (error?.code === "42P07" || error?.message?.includes("already exists")) {
          console.log("ℹ️  景点向量索引已存在，跳过")
        } else {
          console.error("❌ 创建景点向量索引失败:", error.message)
          throw error
        }
      }
    }

    // 创建用户偏好向量索引
    if (hasUserPrefData) {
      try {
        const colType = await getVectorColumnType("user_preference_vectors", "embedding")
        if (!colType) {
          console.log("⚠️  未找到 user_preference_vectors.embedding 列，跳过索引创建")
        } else if (!/^vector\(\d+\)$/.test(colType)) {
          console.log(
            `⚠️  user_preference_vectors.embedding 列类型为 ${colType}（无固定维度），pgvector 无法创建 HNSW/IVFFLAT 索引`
          )
          console.log(
            "   解决方案：必须改成 vector(768) 或 vector(1536) 这种固定维度；或拆成两张表/两列分别存不同维度"
          )
        } else {
        // 检查索引是否已存在
        const indexCheck = await query(`
          SELECT EXISTS (
            SELECT FROM pg_indexes 
            WHERE tablename = 'user_preference_vectors' 
            AND indexname = 'user_preference_vectors_embedding_idx'
          )
        `)

        if (!indexCheck.rows[0].exists) {
          console.log(`📝 创建用户偏好向量索引（列类型: ${colType}）...`)
          await query(`
            CREATE INDEX user_preference_vectors_embedding_idx 
            ON user_preference_vectors 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
          `)
          console.log("✅ 用户偏好向量索引创建完成（HNSW）")
        } else {
          console.log("ℹ️  用户偏好向量索引已存在，跳过")
        }
        }
      } catch (error: any) {
        if (error?.code === "42P07" || error?.message?.includes("already exists")) {
          console.log("ℹ️  用户偏好向量索引已存在，跳过")
        } else {
          console.error("❌ 创建用户偏好向量索引失败:", error.message)
          throw error
        }
      }
    }

    console.log("✅ 向量索引创建完成！")
  } catch (error) {
    console.error("❌ 创建向量索引失败:", error)
    throw error
  } finally {
    await closePool()
  }
}

createVectorIndexes()
  .then(() => {
    console.log("✅ 脚本执行完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error)
    process.exit(1)
  })
