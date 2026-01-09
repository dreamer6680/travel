#!/usr/bin/env tsx
/**
 * 数据库初始化脚本
 * 自动执行 dbinit.ts 中的初始化函数
 */

import { initDatabase } from "../lib/dbinit"

async function main() {
  console.log("🚀 开始初始化数据库...")
  
  try {
    await initDatabase()
    console.log("✅ 数据库初始化完成！")
    process.exit(0)
  } catch (error) {
    console.error("❌ 数据库初始化失败:", error)
    process.exit(1)
  }
}

main()

