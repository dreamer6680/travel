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
      AND table_name IN ('attraction_vectors', 'user_preference_vectors', 'hotel_vectors')
    `)

    if (tablesCheck.rows.length === 3) {
      console.log("✅ 表已存在（含 hotel_vectors），跳过创建")
    } else {
      console.log("📝 创建表结构...")
      
      // 直接执行 SQL 语句（按正确顺序）
      try {
        // 1. 创建函数
        await query(`
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
              NEW.updated_at = CURRENT_TIMESTAMP;
              RETURN NEW;
          END;
          $$ language 'plpgsql';
        `)
        console.log("✅ 创建函数: update_updated_at_column")

        // 2. 创建景点向量表
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
            latitude DECIMAL(10, 7),
            longitude DECIMAL(10, 7),
            coordinate_type VARCHAR(20) DEFAULT 'BD09',
            embedding vector,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `)
        console.log("✅ 创建表: attraction_vectors")

        // 3. 创建景点向量表索引（非向量索引）
        await query(`CREATE INDEX IF NOT EXISTS attraction_vectors_location_idx ON attraction_vectors(location)`)
        await query(`CREATE INDEX IF NOT EXISTS attraction_vectors_type_idx ON attraction_vectors(type)`)
        await query(`CREATE INDEX IF NOT EXISTS attraction_vectors_rating_idx ON attraction_vectors(rating DESC)`)
        await query(`CREATE INDEX IF NOT EXISTS attraction_vectors_attraction_id_idx ON attraction_vectors(attraction_id)`)
        console.log("✅ 创建索引: attraction_vectors (非向量索引)")
        
        // 向量索引需要等有数据后再创建（因为需要知道维度）
        // 将在第一次插入数据后自动创建，或使用 pg:create-vector-indexes 脚本创建

        // 4. 创建触发器
        await query(`
          DROP TRIGGER IF EXISTS update_attraction_vectors_updated_at ON attraction_vectors;
          CREATE TRIGGER update_attraction_vectors_updated_at 
          BEFORE UPDATE ON attraction_vectors 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
        `)
        console.log("✅ 创建触发器: attraction_vectors")

        // 5. 创建用户偏好向量表
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
        console.log("✅ 创建表: user_preference_vectors")

        // 6. 创建用户偏好向量表索引（非向量索引）
        await query(`CREATE INDEX IF NOT EXISTS user_preference_vectors_user_id_idx ON user_preference_vectors(user_id)`)
        console.log("✅ 创建索引: user_preference_vectors (非向量索引)")
        
        // 向量索引需要等有数据后再创建（因为需要知道维度）
        // 将在第一次插入数据后自动创建，或使用 pg:create-vector-indexes 脚本创建

        // 7. 创建触发器
        await query(`
          DROP TRIGGER IF EXISTS update_user_preference_vectors_updated_at ON user_preference_vectors;
          CREATE TRIGGER update_user_preference_vectors_updated_at 
          BEFORE UPDATE ON user_preference_vectors 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
        `)
        console.log("✅ 创建触发器: user_preference_vectors")

        // 8. 酒店向量表（含坐标、地址、房型）
        await query(`
          CREATE TABLE IF NOT EXISTS hotel_vectors (
            id SERIAL PRIMARY KEY,
            hotel_id VARCHAR(64) NOT NULL,
            name VARCHAR(255) NOT NULL,
            location VARCHAR(255),
            star INTEGER DEFAULT 0,
            star_type INTEGER DEFAULT 0,
            type VARCHAR(50) DEFAULT '酒店',
            description TEXT,
            image_url VARCHAR(500),
            rating DECIMAL(3, 1),
            comment_number VARCHAR(100),
            price_display VARCHAR(50),
            price_yuan DECIMAL(10, 2),
            address VARCHAR(500),
            position_desc VARCHAR(500),
            zone_names JSONB,
            latitude DECIMAL(10, 7),
            longitude DECIMAL(10, 7),
            coordinate_type VARCHAR(20) DEFAULT 'BD09',
            rooms JSONB,
            embedding vector,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `)
        await query(`CREATE INDEX IF NOT EXISTS hotel_vectors_location_idx ON hotel_vectors(location)`)
        await query(`CREATE INDEX IF NOT EXISTS hotel_vectors_hotel_id_idx ON hotel_vectors(hotel_id)`)
        await query(`CREATE INDEX IF NOT EXISTS hotel_vectors_rating_idx ON hotel_vectors(rating DESC)`)
        await query(`CREATE INDEX IF NOT EXISTS hotel_vectors_lat_lng_idx ON hotel_vectors(latitude, longitude)`)
        await query(`
          DROP TRIGGER IF EXISTS update_hotel_vectors_updated_at ON hotel_vectors;
          CREATE TRIGGER update_hotel_vectors_updated_at BEFORE UPDATE ON hotel_vectors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        `)
        console.log("✅ 创建表: hotel_vectors")

        // 为已存在的 hotel_vectors 表补充新列（兼容旧库）
        const hotelNewColumns = [
          "ADD COLUMN IF NOT EXISTS address VARCHAR(500)",
          "ADD COLUMN IF NOT EXISTS position_desc VARCHAR(500)",
          "ADD COLUMN IF NOT EXISTS zone_names JSONB",
          "ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7)",
          "ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7)",
          "ADD COLUMN IF NOT EXISTS coordinate_type VARCHAR(20) DEFAULT 'BD09'",
          "ADD COLUMN IF NOT EXISTS rooms JSONB",
        ]
        for (const col of hotelNewColumns) {
          try {
            await query(`ALTER TABLE hotel_vectors ${col}`)
          } catch (e: any) {
            if (e?.code !== "42701") console.log(`ℹ️  hotel_vectors ${col}: ${e?.message}`)
          }
        }
        try {
          await query(`CREATE INDEX IF NOT EXISTS hotel_vectors_lat_lng_idx ON hotel_vectors(latitude, longitude)`)
        } catch (_) {}

        console.log("✅ 表结构创建完成")
      } catch (error: any) {
        // 忽略已存在的错误
        if (
          error?.code === "42P07" || // duplicate_table
          error?.code === "42710" || // duplicate_object
          error?.code === "42723" ||  // duplicate_function
          error?.message?.includes("already exists")
        ) {
          console.log(`ℹ️  对象已存在，跳过: ${error.message}`)
        } else {
          throw error
        }
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
