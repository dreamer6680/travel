#!/usr/bin/env tsx
/**
 * 爬取餐厅并写入 MongoDB Restaurants 集合
 * 策略：先抓携程 POI（餐饮过滤），数量不足时自动补抓高德 POI，保证可达目标条数。
 *
 * 用法:
 *   npx tsx scripts/scrape-ctrip-restaurants.ts [districtId] [--target=200] [--maxPages=80] [--strict]
 */
import "./load-env-local"
import axios from "axios"
import clientPromise, { MONGODB_DB_NAME } from "../lib/db"

interface RestaurantDoc {
  id: number
  name: string
  location: string
  rating: number
  type: string
  description: string
  imageUrl: string
  likes: number
  source?: "ctrip" | "amap"
  sourceId?: string
  coordinate?: {
    latitude: number
    longitude: number
    coordinateType: string
  }
  scrapedAt: string
}

const DISTRICT_CITY: Record<number, string> = {
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

function hashToPositiveInt(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h || 1)
}

/** 旧版窄匹配，条数通常很少 */
function isRestaurantStrict(tags: string[], text: string) {
  const keyword = /(餐|美食|小吃|咖啡|甜品|火锅|烧烤|面|饭|茶饮|酒吧|Food|Restaurant)/i
  return tags.some((t) => keyword.test(t)) || keyword.test(text)
}

/** 名称/标签明显不是餐饮（避免「馆」字误伤） */
function isLikelyNonRestaurant(name: string, tags: string[]) {
  const blob = `${name} ${tags.join(" ")}`
  return /(博物馆|美术馆|纪念馆|陈列馆|展览馆|科技馆|文化宫|图书馆|档案馆|烈士陵园|纪念碑|动物园|植物园|游乐园|主题乐园|水上乐园|海洋世界|水族馆|滑雪场|寺庙|教堂|清真寺|道观|故居|遗址|古墓|石窟|石刻|国家森林公园|湿地公园|自然保护区|古城墙|索道|观光塔|游船中心|轮渡站)/.test(
    blob
  )
}

function isRestaurantLoose(tags: string[], name: string, shortFeatures: string) {
  if (isLikelyNonRestaurant(name, tags)) return false
  const text = `${name} ${shortFeatures}`
  const loose = new RegExp(
    [
      "餐|美食|小吃|咖啡|甜品|火锅|烧烤|面|饭|茶饮|酒吧|Food|Restaurant",
      "料理|食肆|餐饮|饮吧|茶餐厅|西餐厅|中餐厅|快餐|便当|米线|麻辣烫|串串|烤肉",
      "日料|韩餐|泰餐|粤菜|川菜|湘菜|本帮|淮扬|徽菜|闽菜|鲁菜|东北菜|西北菜|新疆菜|清真|素食",
      "农家乐|农庄|大排档|夜市|夜宵|早茶|自助|铁板|寿司|披萨|汉堡|牛排",
      "甜品店|奶茶店|咖啡馆|茶馆|清吧|居酒屋|私房菜|创意菜|融合菜",
      "粥|汤包|生煎|小笼|馄饨|饺子|包子|烧饼|油条|豆浆|拉面|拌面|炒面|盖饭",
      "煲仔|砂锅|干锅|香锅|冒菜|烤鱼|小龙虾|海鲜|涮肉|铜锅|打边炉|寿喜|烧鸟|刺身|天妇罗|定食",
      "简餐|轻食|沙拉|烘焙|面包|蛋糕|西点|中点|糖水|凉茶|奶茶|果汁",
      "酒馆|酒庄|餐吧|餐坊|食府|菜馆|酒楼|饭庄|食街|美食城|美食广场",
      "名吃|老字号|米其林|黑珍珠|撸串|卤味|酱骨|烧腊|茶楼|餐室|餐厅|饭馆|饭店",
      "味蕾|舌尖|招牌菜|必吃|人均|套餐|点菜",
    ].join("|"),
    "i"
  )
  const nameSuffix = /(菜馆|酒楼|饭庄|食府|餐吧|火锅店|烧烤店|小吃店|奶茶店|咖啡馆|茶餐厅|拉面馆|饺子馆|包子铺|粥铺)$/i
  return tags.some((t) => loose.test(t)) || loose.test(text) || nameSuffix.test(name.trim())
}

async function fetchRestaurantPage(page: number, districtId: number, strict: boolean) {
  const cid = "09031018114344642561"
  const traceID = `${cid}-${Date.now()}-${Math.floor(Math.random() * 10000000)}`
  const url = `https://m.ctrip.com/restapi/soa2/18109/json/getAttractionList?_fxpcqlniredt=${cid}&x-traceID=${traceID}`

  const body = {
    head: {
      cid,
      ctok: "",
      cver: "1.0",
      lang: "01",
      sid: "8888",
      syscode: "999",
      auth: "",
      xsid: "",
      extension: [],
    },
    scene: "online",
    districtId,
    index: page,
    sortType: 1,
    count: 20,
    filter: { filterItems: [] },
    returnModuleType: "product",
  }

  const response = await axios.post(url, body, {
    headers: {
      accept: "*/*",
      "content-type": "application/json",
      origin: "https://you.ctrip.com",
      referer: "https://you.ctrip.com/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    },
    timeout: 15000,
  })

  const list = response.data?.attractionList || []
  return list
    .map((item: any) => item.card)
    .filter((card: any) => card?.poiId && card?.poiName)
    .filter((card: any) => {
      const tags: string[] = Array.isArray(card.tagNameList) ? card.tagNameList : []
      const name = String(card.poiName || "")
      const feat = String(card.shortFeatures || "")
      return strict
        ? isRestaurantStrict(tags, `${name} ${feat}`)
        : isRestaurantLoose(tags, name, feat)
    })
    .map(
      (card: any): RestaurantDoc => ({
        id: Number(card.poiId),
        sourceId: String(card.poiId),
        source: "ctrip",
        name: String(card.poiName || ""),
        location: String(card.districtName || ""),
        rating: Number(card.commentScore || 0),
        type: (Array.isArray(card.tagNameList) && card.tagNameList[0]) || "餐厅",
        description: String(card.shortFeatures || ""),
        imageUrl: String(card.coverImageUrl || ""),
        likes: Number(card.commentCount || 0),
        coordinate: card.coordinate
          ? {
              latitude: Number(card.coordinate.latitude),
              longitude: Number(card.coordinate.longitude),
              coordinateType: String(card.coordinate.coordinateType || "BD09"),
            }
          : undefined,
        scrapedAt: new Date().toISOString(),
      })
    )
}

async function fetchRestaurantPageWithRetry(page: number, districtId: number, strict: boolean) {
  let lastErr: unknown = null
  for (let i = 1; i <= 3; i++) {
    try {
      return await fetchRestaurantPage(page, districtId, strict)
    } catch (e) {
      lastErr = e
      console.warn(`⚠️ 餐厅第 ${page} 页请求失败（第 ${i}/3 次），准备重试`)
      await new Promise((r) => setTimeout(r, 1200 * i))
    }
  }
  throw lastErr
}

async function fetchAmapRestaurants(city: string, needed: number): Promise<RestaurantDoc[]> {
  const key = (process.env.AMAP_WEB_SERVICE_KEY || "").trim()
  if (!key || needed <= 0) return []

  const keywords = ["餐厅", "美食", "小吃", "火锅", "咖啡", "烧烤", "日料", "粤菜"]
  const seenAmap = new Set<string>()
  const out: RestaurantDoc[] = []

  for (const kw of keywords) {
    for (let page = 1; page <= 45 && out.length < needed; page++) {
      const url = "https://restapi.amap.com/v3/place/text"
      const res = await axios.get(url, {
        params: {
          key,
          keywords: kw,
          city,
          citylimit: true,
          offset: 20,
          page,
          extensions: "base",
          types: "050000",
        },
        timeout: 12000,
      })
      const pois: any[] = Array.isArray(res.data?.pois) ? res.data.pois : []
      if (pois.length === 0) break

      let added = 0
      for (const poi of pois) {
        const sid = String(poi.id || "")
        if (!sid || seenAmap.has(sid)) continue
        seenAmap.add(sid)

        const loc = String(poi.location || "")
        const [lngS, latS] = loc.split(",")
        const lng = Number(lngS)
        const lat = Number(latS)

        out.push({
          id: hashToPositiveInt(`amap:${sid}`),
          source: "amap",
          sourceId: sid,
          name: String(poi.name || ""),
          location: String(poi.address || poi.pname || city || ""),
          rating: 0,
          type: String(poi.type || "餐厅"),
          description: String(poi.type || "高德餐饮POI"),
          imageUrl: "",
          likes: 0,
          coordinate:
            Number.isFinite(lat) && Number.isFinite(lng)
              ? {
                  latitude: lat,
                  longitude: lng,
                  coordinateType: "GCJ02",
                }
              : undefined,
          scrapedAt: new Date().toISOString(),
        })
        added++
        if (out.length >= needed) break
      }
      console.log(`🧭 Amap(${kw}) 第${page}页: +${added}/${pois.length}，累计 ${out.length}/${needed}`)
      await new Promise((r) => setTimeout(r, 500))
    }
    if (out.length >= needed) break
  }

  return out
}

function parseArgs() {
  const argv = process.argv.slice(2)
  const strict = argv.includes("--strict") || argv.some((a) => a === "--mode=strict")
  const districtId = Number(argv.find((a) => !a.startsWith("--")) || "2")
  const target = getArg("target", 200)
  const maxPages = getArg("maxPages", 80)
  return {
    districtId: Number.isFinite(districtId) ? districtId : 2,
    target,
    maxPages,
    strict,
  }
}

async function main() {
  const { districtId, target, maxPages, strict } = parseArgs()
  const city = DISTRICT_CITY[districtId] || "上海"
  if (!strict) {
    console.log("📌 使用宽松餐饮匹配（--strict 可改为窄匹配、条数更少）")
  }

  const client = await clientPromise
  const db = client.db(MONGODB_DB_NAME)
  const collection = db.collection<RestaurantDoc>("Restaurants")

  const seen = new Set<number>()
  const collected: RestaurantDoc[] = []
  let consecutiveEmpty = 0

  for (let page = 1; page <= maxPages && collected.length < target; page++) {
    const rows = await fetchRestaurantPageWithRetry(page, districtId, strict)
    let newlyAdded = 0
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      collected.push(row)
      newlyAdded++
      if (collected.length >= target) break
    }

    console.log(`🍜 Ctrip: 第${page}页，新增 ${newlyAdded}/${rows.length}，累计 ${collected.length}/${target}`)
    if (newlyAdded === 0) consecutiveEmpty++
    else consecutiveEmpty = 0

    if (consecutiveEmpty >= 3) break
    await new Promise((r) => setTimeout(r, 1200))
  }

  if (collected.length < target) {
    const needed = target - collected.length
    console.log(`📉 携程不足 ${target}，改用高德补齐，需补 ${needed} 条...`)
    const amapRows = await fetchAmapRestaurants(city, needed)
    for (const row of amapRows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      collected.push(row)
      if (collected.length >= target) break
    }
  }

  const docs = collected.slice(0, target)
  if (docs.length === 0) {
    console.log("❌ 未获取到餐厅数据，建议稍后重试或检查 AMAP_WEB_SERVICE_KEY")
    return
  }

  const ops = docs.map((row) => ({
    updateOne: {
      filter: row.sourceId ? { source: row.source, sourceId: row.sourceId } : { id: row.id },
      update: { $set: row },
      upsert: true,
    },
  }))

  const result = await collection.bulkWrite(ops, { ordered: false })
  const inDb = await collection.countDocuments({})

  const ctripCount = docs.filter((d) => d.source === "ctrip").length
  const amapCount = docs.filter((d) => d.source === "amap").length
  console.log(
    `✅ 餐厅数据入库完成，本次 ${docs.length} 条（ctrip=${ctripCount}, amap=${amapCount}），upserted=${result.upsertedCount} modified=${result.modifiedCount}，库内总数=${inDb}`
  )
}

main().catch((e) => {
  console.error("❌ 餐厅爬取失败:", e)
  process.exit(1)
})
