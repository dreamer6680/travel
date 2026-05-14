#!/usr/bin/env tsx
/**
 * 一键初始化：
 * 1) 启动 docker 容器（mongo + pgvector）
 * 2) 等待数据库就绪
 * 3) 爬取景区、酒店、餐厅到 Mongo
 * 4) 向量化写入 PG
 */
import "./load-env-local"
import { execSync } from "node:child_process"

/** 按精确容器名判断是否存在（避免 name= 过滤子串误匹配） */
function containerExists(name: string) {
  try {
    execSync(`docker container inspect "${name}"`, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function run(cmd: string) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: "inherit" })
}

function getArg(name: string, fallback: string) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split("=")[1] : fallback
}

async function main() {
  const districtId = getArg("districtId", "2") // 上海
  const scenicPages = getArg("scenicPages", "10")
  const hotelPages = getArg("hotelPages", "5")
  const restaurantPages = getArg("restaurantPages", "10")

  console.log("🚀 一键初始化开始")
  console.log(
    `参数: districtId=${districtId}, scenicPages=${scenicPages}, hotelPages=${hotelPages}, restaurantPages=${restaurantPages}`
  )

  const hasMongo = containerExists("travel-mongodb")
  const hasPostgres = containerExists("travel-postgres")

  // 不能只跑「缺一个就 up 两个」：已存在的固定 container_name 会报 Conflict
  if (!hasMongo && !hasPostgres) {
    run("docker compose up -d mongodb postgres")
  } else {
    if (!hasMongo) {
      run("docker compose up -d mongodb")
    } else {
      run("docker start travel-mongodb")
    }
    if (!hasPostgres) {
      run("docker compose up -d postgres")
    } else {
      run("docker start travel-postgres")
    }
  }
  run("pnpm db:wait")

  // 景区
  run("pnpm scrape")
  // 酒店
  run(`tsx scripts/scrape-ctrip-hotels.ts ${districtId} --pages=${hotelPages}`)
  // 餐厅
  run(`tsx scripts/scrape-ctrip-restaurants.ts ${districtId} ${restaurantPages}`)
  // Mongo -> PG 向量化（需本机 Ollama）
  run("tsx scripts/wait-for-ollama.ts")
  run("tsx scripts/vectorize-mongo-to-pg.ts")

  console.log("\n✅ 全部完成：容器已启动、数据已入 Mongo、向量已写入 PG")
}

main().catch((e) => {
  console.error("❌ 一键初始化失败:", e)
  process.exit(1)
})
