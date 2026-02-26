#!/usr/bin/env tsx
/**
 * 执行数据爬取脚本
 */

import { main } from "../lib/scrape"

main()
  .then(() => {
    console.log("✅ 数据爬取完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ 数据爬取失败:", error)
    process.exit(1)
  })
