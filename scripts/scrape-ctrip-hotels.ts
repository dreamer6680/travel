#!/usr/bin/env tsx
/**
 * 爬取携程酒店并写入 MongoDB Hotels 集合
 * 默认使用 fetchHotelList 分页拉取；加 --ad 使用 getAdHotels 热门/达人推荐
 * 需配置 CTRIP_PHANTOM_TOKEN（可选 CTRIP_COOKIE）
 *
 * 用法:
 *   npx tsx scripts/scrape-ctrip-hotels.ts [cityId] [--target=200] [--maxPages=80]
 */
import "./load-env-local"
import clientPromise from "../lib/db"
import { MONGODB_DB_NAME } from "../lib/db"
import { fetchCtripAdHotels, fetchCtripHotelList, type CtripHotelItem } from "./ctrip-hotels"

const CITY_NAMES: Record<number, string> = {
  1: "北京",
  2: "上海",
  3: "广州",
  4: "深圳",
  8: "杭州",
  10: "南京",
  17: "成都",
  18: "重庆",
  23: "西安",
  25: "苏州",
}

function getArg(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (!raw) return fallback
  const val = Number(raw.split("=")[1])
  return Number.isFinite(val) && val > 0 ? Math.floor(val) : fallback
}

function envLen(name: string) {
  return (process.env[name] || "").trim().replace(/^["']/, "").replace(/["']$/, "").length
}

async function fetchHotelListWithRetry(cityId: number, pageIndex: number, pageSize: number) {
  let lastErr: unknown = null
  for (let i = 1; i <= 3; i++) {
    try {
      return await fetchCtripHotelList(cityId, { pageIndex, pageSize })
    } catch (e) {
      lastErr = e
      console.warn(`⚠️ 酒店第 ${pageIndex} 页请求失败（第 ${i}/3 次），准备重试`) 
      await new Promise((r) => setTimeout(r, 1200 * i))
    }
  }
  throw lastErr
}

async function main() {
  const args = process.argv.slice(2)
  const cityId = parseInt(args.find((a) => !a.startsWith("--")) || "2", 10)
  const useAd = args.includes("--ad")
  const target = getArg("target", 200)
  const maxPages = getArg("maxPages", 80)
  const pageSize = getArg("pageSize", 20)
  const cityName = CITY_NAMES[cityId] ?? `城市${cityId}`

  console.log(
    `🏨 爬取携程酒店 cityId=${cityId} (${cityName})，目标=${target}，模式: ${
      useAd ? "getAdHotels" : "fetchHotelList 分页"
    }`
  )

  const tokenLen = envLen("CTRIP_PHANTOM_TOKEN")
  const cookieLen = envLen("CTRIP_COOKIE")
  console.log(`🔐 鉴权参数: phantom-token 长度=${tokenLen}, cookie 长度=${cookieLen}`)

  if (tokenLen === 0) {
    console.warn(
      "⚠️  未设置 CTRIP_PHANTOM_TOKEN，请求可能被拒。请在 .env.local 中配置（从浏览器请求头 phantom-token 复制）"
    )
  }

  const seen = new Set<string>()
  const hotels: CtripHotelItem[] = []

  if (useAd) {
    const adHotels = await fetchCtripAdHotels(cityId)
    for (const h of adHotels) {
      if (h.hotelId && !seen.has(h.hotelId)) {
        seen.add(h.hotelId)
        hotels.push(h)
      }
      if (hotels.length >= target) break
    }
  } else {
    let consecutiveEmpty = 0
    for (let page = 1; page <= maxPages && hotels.length < target; page++) {
      const { hotels: pageHotels, isLastPage } = await fetchHotelListWithRetry(cityId, page, pageSize)
      let newlyAdded = 0
      for (const h of pageHotels) {
        if (h.hotelId && !seen.has(h.hotelId)) {
          seen.add(h.hotelId)
          hotels.push(h)
          newlyAdded++
        }
        if (hotels.length >= target) break
      }
      console.log(`  第 ${page} 页: +${newlyAdded}/${pageHotels.length} 条，累计 ${hotels.length}/${target}`)

      if (newlyAdded === 0) consecutiveEmpty++
      else consecutiveEmpty = 0

      if (isLastPage || consecutiveEmpty >= 3) break
      await new Promise((r) => setTimeout(r, 1200))
    }
  }

  console.log(`✅ 获取到 ${hotels.length} 条酒店（已去重）`)

  if (hotels.length === 0) {
    console.log("")
    console.log("无数据。若接口返回 Success 但列表为空，多为携程风控/限流，可稍后重试或更换网络。否则请配置：")
    console.log("")
    console.log("1. CTRIP_PHANTOM_TOKEN（必填）")
    console.log("   - 打开 https://hotels.ctrip.com/ 并登录")
    console.log("   - F12 打开开发者工具 → Network，刷新页面并点击任意酒店列表请求（如 fetchHotelList）")
    console.log("   - 在 Request Headers 里找到 phantom-token，复制整段值")
    console.log("   - 在项目根目录 .env.local 中添加：CTRIP_PHANTOM_TOKEN=粘贴的值")
    console.log("")
    console.log("2. CTRIP_COOKIE（可选，若仅 token 仍无数据可再配置）")
    console.log("   - 同上，在 Request Headers 里复制 Cookie 整段")
    console.log("   - .env.local 中添加：CTRIP_COOKIE=粘贴的值")
    console.log("")
    console.log("注意：phantom-token 会过期；风控时需隔一段时间再试或重新从浏览器复制 token/cookie。")
    return
  }

  const client = await clientPromise
  const db = client.db(MONGODB_DB_NAME)
  const coll = db.collection<CtripHotelItem & { cityName: string; scrapedAt: string }>("Hotels")

  const docs = hotels.slice(0, target).map((h) => ({
    ...h,
    cityName: h.cityName ?? cityName,
    scrapedAt: new Date().toISOString(),
  }))

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { cityId: doc.cityId, hotelId: doc.hotelId },
      update: { $set: doc },
      upsert: true,
    },
  }))

  const result = await coll.bulkWrite(ops, { ordered: false })
  const inDb = await coll.countDocuments({ cityId })
  console.log(
    `✅ 已写入/更新 MongoDB Hotels，cityId=${cityId}，upserted=${result.upsertedCount} modified=${result.modifiedCount}，当前库内=${inDb}`
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ 酒店爬取失败:", e)
    process.exit(1)
  })
