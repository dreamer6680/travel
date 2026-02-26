#!/usr/bin/env tsx
/**
 * 为 attraction_vectors 表添加坐标字段
 */

import { query, waitForDatabase, closePool } from "../lib/db-pg"

async function addCoordinateColumns() {
  try {
    console.log("🚀 开始添加坐标字段...")

    // 等待数据库就绪
    await waitForDatabase()

    // 检查字段是否已存在
    const columnCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'attraction_vectors' 
      AND column_name IN ('latitude', 'longitude', 'coordinate_type')
    `)

    const existingColumns = columnCheck.rows.map((row) => row.column_name)
    const needsLatitude = !existingColumns.includes('latitude')
    const needsLongitude = !existingColumns.includes('longitude')
    const needsCoordinateType = !existingColumns.includes('coordinate_type')

    if (!needsLatitude && !needsLongitude && !needsCoordinateType) {
      console.log("✅ 坐标字段已存在，跳过")
      return
    }

    // 添加字段
    if (needsLatitude) {
      await query(`
        ALTER TABLE attraction_vectors 
        ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7)
      `)
      console.log("✅ 已添加 latitude 字段")
    }

    if (needsLongitude) {
      await query(`
        ALTER TABLE attraction_vectors 
        ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7)
      `)
      console.log("✅ 已添加 longitude 字段")
    }

    if (needsCoordinateType) {
      await query(`
        ALTER TABLE attraction_vectors 
        ADD COLUMN IF NOT EXISTS coordinate_type VARCHAR(20) DEFAULT 'BD09'
      `)
      console.log("✅ 已添加 coordinate_type 字段")
    }

    // 从 metadata 中迁移现有坐标数据
    console.log("📝 从 metadata 迁移现有坐标数据...")
    const updateResult = await query(`
      UPDATE attraction_vectors
      SET 
        latitude = CAST((metadata->'coordinate'->>'latitude') AS DECIMAL),
        longitude = CAST((metadata->'coordinate'->>'longitude') AS DECIMAL),
        coordinate_type = COALESCE(metadata->'coordinate'->>'coordinateType', 'BD09')
      WHERE 
        metadata->'coordinate' IS NOT NULL
        AND (latitude IS NULL OR longitude IS NULL)
        AND metadata->'coordinate'->>'latitude' IS NOT NULL
        AND metadata->'coordinate'->>'longitude' IS NOT NULL
    `)
    console.log(`✅ 已迁移 ${updateResult.rowCount} 条记录的坐标数据`)

    console.log("✅ 坐标字段添加完成！")
  } catch (error) {
    console.error("❌ 添加坐标字段失败:", error)
    throw error
  } finally {
    await closePool()
  }
}

addCoordinateColumns()
  .then(() => {
    console.log("✅ 脚本执行完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error)
    process.exit(1)
  })
