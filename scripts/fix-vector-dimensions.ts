#!/usr/bin/env tsx
/**
 * 修复向量维度问题：从固定 1536 维改为动态维度
 * 支持 OpenAI (1536维) 和 Ollama (768维)
 */

import { query, waitForDatabase, closePool } from "../lib/db-pg"

async function fixVectorDimensions() {
  try {
    console.log("🔧 开始修复向量维度...")

    // 等待数据库就绪
    await waitForDatabase()

    // 检查表是否存在
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'attraction_vectors'
      )`
    )

    if (tableCheck.rows[0].exists) {
      console.log("📋 检测到现有表，开始修复...")

      // 1. 删除旧的索引
      console.log("🗑️  删除旧索引...")
      try {
        await query("DROP INDEX IF EXISTS attraction_vectors_embedding_idx")
        await query("DROP INDEX IF EXISTS user_preference_vectors_embedding_idx")
        console.log("✅ 旧索引已删除")
      } catch (error) {
        console.log("ℹ️  索引可能不存在，跳过")
      }

      // 2. 检查当前列类型（检查是否有维度限制）
      // 使用 pg_attribute 和 pg_type 直接查询
      const columnCheck = await query(`
        SELECT 
          t.typname as type_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) as full_type
        FROM pg_attribute a
        JOIN pg_type t ON a.atttypid = t.oid
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relname = 'attraction_vectors'
        AND a.attname = 'embedding'
        AND n.nspname = 'public'
        AND NOT a.attisdropped
      `)

      if (columnCheck.rows.length > 0) {
        const fullType = columnCheck.rows[0].full_type || ""
        console.log(`📊 当前向量列类型: ${fullType}`)

        // 检查是否是固定维度（包含括号和数字）
        const isFixedDimension = /vector\(\d+\)/i.test(fullType)

        // 如果已经是动态维度，跳过
        if (!isFixedDimension && fullType.toLowerCase() === "vector") {
          console.log("✅ 向量列已经是动态维度，无需修复")
        } else {
          // 修改列类型为动态维度
          console.log("🔄 修改向量列类型为动态维度...")
          
          // 先清空表（因为维度不匹配的数据无法转换）
          const countResult = await query("SELECT COUNT(*) as count FROM attraction_vectors")
          const count = parseInt(countResult.rows[0].count)
          
          if (count > 0) {
            console.log(`⚠️  表中有 ${count} 条数据，需要清空以修复维度问题`)
            console.log("🗑️  清空表数据...")
            await query("TRUNCATE TABLE attraction_vectors")
            console.log("✅ 表数据已清空")
          }

          // 修改列类型
          // 注意：PostgreSQL 的 vector 类型支持从固定维度转换到动态维度
          // 但需要确保表中没有数据（我们已经清空了）
          console.log("🔄 修改向量列类型为动态维度...")
          try {
            await query(`
              ALTER TABLE attraction_vectors 
              ALTER COLUMN embedding TYPE vector
            `)
            console.log("✅ attraction_vectors 表已修复")
          } catch (error: any) {
            // 如果直接转换失败，尝试删除并重新创建列
            console.log("⚠️  直接转换失败，尝试删除并重新创建列...")
            await query(`
              ALTER TABLE attraction_vectors 
              DROP COLUMN embedding
            `)
            await query(`
              ALTER TABLE attraction_vectors 
              ADD COLUMN embedding vector
            `)
            console.log("✅ attraction_vectors 表已修复（通过删除重建）")
          }

          // 同样处理 user_preference_vectors
          const userPrefTableCheck = await query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'user_preference_vectors'
            )
          `)
          
          if (userPrefTableCheck.rows[0].exists) {
            try {
              await query(`
                ALTER TABLE user_preference_vectors 
                ALTER COLUMN embedding TYPE vector
              `)
              console.log("✅ user_preference_vectors 表已修复")
            } catch (error: any) {
              console.log("⚠️  直接转换失败，尝试删除并重新创建列...")
              await query(`
                ALTER TABLE user_preference_vectors 
                DROP COLUMN embedding
              `)
              await query(`
                ALTER TABLE user_preference_vectors 
                ADD COLUMN embedding vector
              `)
              console.log("✅ user_preference_vectors 表已修复（通过删除重建）")
            }
          }

          console.log("✅ 向量列类型已修改为动态维度")
        }
      }

      // 3. 重新创建索引（只在有数据时创建向量索引）
      console.log("🔨 重新创建索引...")
      
      // 检查是否有向量数据
      const attractionDataCheck = await query(
        "SELECT COUNT(*) as count FROM attraction_vectors WHERE embedding IS NOT NULL"
      )
      const userPrefDataCheck = await query(
        "SELECT COUNT(*) as count FROM user_preference_vectors WHERE embedding IS NOT NULL"
      )

      const hasAttractionData = parseInt(attractionDataCheck.rows[0].count) > 0
      const hasUserPrefData = parseInt(userPrefDataCheck.rows[0].count) > 0

      // 创建非向量索引
      await query(`CREATE INDEX IF NOT EXISTS attraction_vectors_location_idx ON attraction_vectors(location)`)
      await query(`CREATE INDEX IF NOT EXISTS attraction_vectors_type_idx ON attraction_vectors(type)`)
      await query(`CREATE INDEX IF NOT EXISTS attraction_vectors_rating_idx ON attraction_vectors(rating DESC)`)
      await query(`CREATE INDEX IF NOT EXISTS attraction_vectors_attraction_id_idx ON attraction_vectors(attraction_id)`)
      await query(`CREATE INDEX IF NOT EXISTS user_preference_vectors_user_id_idx ON user_preference_vectors(user_id)`)
      console.log("✅ 非向量索引已创建")

      // 只在有数据时创建向量索引
      if (hasAttractionData) {
        try {
          await query(`
            CREATE INDEX IF NOT EXISTS attraction_vectors_embedding_idx 
            ON attraction_vectors 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
          `)
          console.log("✅ 景点向量索引已创建")
        } catch (error: any) {
          if (error?.code === "42P07" || error?.message?.includes("already exists")) {
            console.log("ℹ️  景点向量索引已存在，跳过")
          } else {
            console.warn("⚠️  创建景点向量索引失败（可能维度不一致）:", error.message)
            console.log("   提示：请确保所有向量具有相同的维度，或运行 pnpm run pg:create-indexes 手动创建")
          }
        }
      } else {
        console.log("ℹ️  景点向量表无数据，跳过向量索引创建（将在有数据后自动创建）")
      }

      if (hasUserPrefData) {
        try {
          await query(`
            CREATE INDEX IF NOT EXISTS user_preference_vectors_embedding_idx 
            ON user_preference_vectors 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
          `)
          console.log("✅ 用户偏好向量索引已创建")
        } catch (error: any) {
          if (error?.code === "42P07" || error?.message?.includes("already exists")) {
            console.log("ℹ️  用户偏好向量索引已存在，跳过")
          } else {
            console.warn("⚠️  创建用户偏好向量索引失败（可能维度不一致）:", error.message)
            console.log("   提示：请确保所有向量具有相同的维度，或运行 pnpm run pg:create-indexes 手动创建")
          }
        }
      } else {
        console.log("ℹ️  用户偏好向量表无数据，跳过向量索引创建（将在有数据后自动创建）")
      }
    } else {
      console.log("📋 表不存在，将创建新表（支持动态维度）")
      // 直接执行初始化 SQL
      await query("CREATE EXTENSION IF NOT EXISTS vector")
      
      await query(`
        CREATE TABLE IF NOT EXISTS attraction_vectors (
          id SERIAL PRIMARY KEY,
          attraction_id INTEGER NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          location VARCHAR(255),
          rating DECIMAL(3, 1),
          type VARCHAR(100),
          description TEXT,
          image_url VARCHAR(500),
          likes INTEGER DEFAULT 0,
          embedding vector,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      // 创建非向量索引
      await query(`
        CREATE INDEX IF NOT EXISTS attraction_vectors_location_idx ON attraction_vectors(location)
      `)
      
      await query(`
        CREATE INDEX IF NOT EXISTS attraction_vectors_type_idx ON attraction_vectors(type)
      `)
      
      await query(`
        CREATE INDEX IF NOT EXISTS attraction_vectors_rating_idx ON attraction_vectors(rating DESC)
      `)
      
      await query(`
        CREATE INDEX IF NOT EXISTS attraction_vectors_attraction_id_idx ON attraction_vectors(attraction_id)
      `)
      
      await query(`
        CREATE TABLE IF NOT EXISTS user_preference_vectors (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL UNIQUE,
          preference_text TEXT NOT NULL,
          embedding vector,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      await query(`
        CREATE INDEX IF NOT EXISTS user_preference_vectors_user_id_idx ON user_preference_vectors(user_id)
      `)
      
      console.log("✅ 表已创建（支持动态维度）")
      console.log("ℹ️  向量索引将在有数据后自动创建，或运行 pnpm run pg:create-indexes 手动创建")
    }

    console.log("✅ 向量维度修复完成！")
    console.log("📝 现在支持：")
    console.log("   - OpenAI: 1536 维")
    console.log("   - Ollama: 768 维")
  } catch (error) {
    console.error("❌ 修复失败:", error)
    throw error
  } finally {
    await closePool()
  }
}

fixVectorDimensions()
  .then(() => {
    console.log("✅ 脚本执行完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error)
    process.exit(1)
  })
