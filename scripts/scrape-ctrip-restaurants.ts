#!/usr/bin/env tsx
/**
 * 爬取携程餐厅/美食相关 POI 并写入 MongoDB Restaurants 集合
 * 数据源：m.ctrip.com getAttractionList（与景点同源），通过关键词筛选餐饮类 POI。
 * 携程未公开独立「美食列表」接口时，这是可行方案；需要更多数据请用默认「宽松」模式。
 *
 * 用法:
 *   npx tsx scripts/scrape-ctrip-restaurants.ts [districtId] [pages] [--strict]
 *   --strict  仅保留名称/标签强匹配餐饮（条数少、精度高）
 *   默认      宽松匹配（扩展词表 + 排除博物馆/公园等非餐饮「馆/园」）
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
  coordinate?: {
    latitude: number
    longitude: number
    coordinateType: string
  }
  scrapedAt: string
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

/**
 * 宽松：扩展菜系/业态词 + 常见餐饮后缀；仍排除明显景点类 POI
 */
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

async function fetchRestaurantPage(
  page: number,
  districtId: number,
  strict: boolean
): Promise<RestaurantDoc[]> {
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
    count: 10,
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
    .map((card: any) => ({
      id: Number(card.poiId),
      name: String(card.poiName || ""),
      location: String(card.districtName || ""),
      rating: Number(card.commentScore || 0),
      type:
        (Array.isArray(card.tagNameList) && card.tagNameList[0]) || "餐厅",
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
    }))
}

function parseArgs() {
  const argv = process.argv.slice(2)
  const strict = argv.includes("--strict") || argv.some((a) => a === "--mode=strict")
  const nums = argv
    .filter((a) => !a.startsWith("--"))
    .map((a) => Number(a))
    .filter((n) => !Number.isNaN(n))
  const districtId = nums[0] ?? 2
  const pages = nums[1] ?? 10
  return { districtId, pages, strict }
}

async function main() {
  const { districtId, pages, strict } = parseArgs()
  if (!strict) {
    console.log("📌 使用宽松餐饮匹配（--strict 可改为窄匹配、条数更少）")
  }
  const client = await clientPromise
  const db = client.db(MONGODB_DB_NAME)
  const collection = db.collection<RestaurantDoc>("Restaurants")
  const seen = new Set<number>()
  let total = 0

  for (let page = 1; page <= pages; page++) {
    const rows = await fetchRestaurantPage(page, districtId, strict)
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      await collection.updateOne(
        { id: row.id },
        { $set: row },
        { upsert: true }
      )
      total++
    }
    console.log(`🍜 餐厅爬取: 第${page}页，累计 ${total}`)
    if (page < pages) await new Promise((r) => setTimeout(r, 1200))
  }

  await client.close()
  console.log(`✅ 餐厅数据入库完成，共 ${total} 条`)
}

main().catch((e) => {
  console.error("❌ 餐厅爬取失败:", e)
  process.exit(1)
})
