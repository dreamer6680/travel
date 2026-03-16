#!/usr/bin/env tsx
/**
 * 爬取携程酒店并写入 MongoDB Hotels 集合
 * 默认使用 fetchHotelList 分页拉取；加 --ad 使用 getAdHotels 热门/达人推荐
 * 需配置 CTRIP_PHANTOM_TOKEN（可选 CTRIP_COOKIE）
 * 使用: npx tsx scripts/scrape-ctrip-hotels.ts [cityId] [--ad] [--pages=5]
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

async function main() {
  const args = process.argv.slice(2)
  const cityId = parseInt(args.find((a) => !a.startsWith("--")) || "2", 10)
  const useAd = args.includes("--ad")
  const pagesArg = args.find((a) => a.startsWith("--pages="))
  const maxPages = pagesArg ? parseInt(pagesArg.split("=")[1], 10) || 5 : 5
  const cityName = CITY_NAMES[cityId] ?? `城市${cityId}`

  console.log(`🏨 爬取携程酒店 cityId=${cityId} (${cityName})，模式: ${useAd ? "getAdHotels" : "fetchHotelList 分页"} ...`)

  if (!process.env.CTRIP_PHANTOM_TOKEN) {
    console.warn(
      "⚠️  未设置 CTRIP_PHANTOM_TOKEN，请求可能被拒。请在 .env.local 中配置（从浏览器请求头 phantom-token 复制）"
    )
  }

  let hotels: CtripHotelItem[] = []

  if (useAd) {
    hotels = await fetchCtripAdHotels(cityId)
  } else {
    const seen = new Set<string>()
    for (let page = 1; page <= maxPages; page++) {
      const { hotels: pageHotels, isLastPage } = await fetchCtripHotelList(cityId, {
        pageIndex: page,
        pageSize: 10,
      })
      for (const h of pageHotels) {
        if (h.hotelId && !seen.has(h.hotelId)) {
          seen.add(h.hotelId)
          hotels.push(h)
        }
      }
      console.log(`  第 ${page} 页: +${pageHotels.length} 条，累计 ${hotels.length} 条`)
      if (isLastPage || pageHotels.length === 0) break
      await new Promise((r) => setTimeout(r, 1500))
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
    try {
      const client = await clientPromise
      await client.close()
    } catch {
      // 忽略关闭失败
    }
    return
  }

  const client = await clientPromise
  const db = client.db(MONGODB_DB_NAME)
  const coll = db.collection<
    CtripHotelItem & { cityName: string; scrapedAt: string }
  >("Hotels")

  const docs = hotels.map((h) => ({
    ...h,
    cityName: h.cityName ?? cityName,
    scrapedAt: new Date().toISOString(),
  }))

  for (const doc of docs) {
    await coll.updateOne(
      { cityId: doc.cityId, hotelId: doc.hotelId },
      { $set: doc },
      { upsert: true }
    )
  }

  console.log(`✅ 已写入/更新 MongoDB Hotels，cityId=${cityId}`)

  // 退出前关闭连接，避免 Windows 下 Node/libuv 断言失败
  await client.close()
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
