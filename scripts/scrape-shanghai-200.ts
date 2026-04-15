#!/usr/bin/env tsx
/**
 * 一键爬取上海数据：200 酒店 + 200 餐厅，并打印 Mongo 入库数量
 */
import "./load-env-local"
import { execSync } from "node:child_process"
import clientPromise, { MONGODB_DB_NAME } from "../lib/db"

function run(cmd: string) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: "inherit" })
}

async function main() {
  const hotelTarget = Number(process.argv.find((a) => a.startsWith("--hotelTarget="))?.split("=")[1] || "200")
  const restaurantTarget = Number(process.argv.find((a) => a.startsWith("--restaurantTarget="))?.split("=")[1] || "200")

  console.log(`🚀 开始上海数据抓取: 酒店=${hotelTarget}, 餐厅=${restaurantTarget}`)

  run("docker compose up -d mongodb")
  run("pnpm db:wait")

  run(`tsx scripts/scrape-ctrip-hotels.ts 2 --target=${hotelTarget} --maxPages=100 --pageSize=20`)
  run(`tsx scripts/scrape-ctrip-restaurants.ts 2 --target=${restaurantTarget} --maxPages=120`)

  const client = await clientPromise
  const db = client.db(MONGODB_DB_NAME)
  const [hotelCount, restaurantCount] = await Promise.all([
    db.collection("Hotels").countDocuments({ cityId: 2 }),
    db.collection("Restaurants").countDocuments({}),
  ])

  console.log(`\n✅ 完成。Mongo 当前计数：上海酒店=${hotelCount}，餐厅=${restaurantCount}`)
}

main().catch((e) => {
  console.error("❌ 上海 200 数据抓取失败:", e)
  process.exit(1)
})
