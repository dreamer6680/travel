#!/usr/bin/env tsx
/**
 * 等待 MongoDB 就绪的脚本
 */

import { MongoClient } from "mongodb"

// 支持多种连接方式
const MONGODB_URI = 
  process.env.MONGODB_URI || 
  (process.env.MONGO_ROOT_USERNAME && process.env.MONGO_ROOT_PASSWORD
    ? `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@localhost:27017/?authSource=admin`
    : "mongodb://localhost:27017")

const MAX_RETRIES = 30
const RETRY_DELAY = 2000 // 2秒

async function waitForMongo() {
  console.log("⏳ 等待 MongoDB 启动...")
  console.log(`📍 连接地址: ${MONGODB_URI.replace(/:[^:@]+@/, ':****@')}`) // 隐藏密码
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const client = new MongoClient(MONGODB_URI)
      await client.connect()
      await client.db().admin().ping()
      await client.close()
      console.log("✅ MongoDB 已就绪！")
      return true
    } catch (error) {
      if (i === MAX_RETRIES - 1) {
        console.error("❌ MongoDB 连接超时")
        throw error
      }
      console.log(`⏳ 尝试连接 MongoDB... (${i + 1}/${MAX_RETRIES})`)
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
    }
  }
  
  return false
}

waitForMongo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

