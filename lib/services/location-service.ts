/**
 * 地点提取和地理编码服务
 * 使用高德地图 API 进行地理编码
 */

export interface Coordinate {
  lat: number
  lng: number
}

export interface LocationInfo {
  name: string
  address: string
  coordinate: Coordinate
  formattedAddress?: string
  district?: string
  city?: string
}

/**
 * 使用高德地图地理编码 API 获取坐标
 */
export async function geocodeAddress(
  address: string,
  city?: string
): Promise<LocationInfo | null> {
  try {
    const apiKey = process.env.AMAP_WEB_SERVICE_KEY || process.env.NEXT_PUBLIC_AMAP_KEY
    if (!apiKey) {
      console.warn("高德地图 API Key 未设置，无法进行地理编码")
      return null
    }

    // 构建查询参数
    const params = new URLSearchParams({
      key: apiKey,
      address: address,
      output: "json",
    })

    if (city) {
      params.append("city", city)
    }

    const url = `https://restapi.amap.com/v3/geocode/geo?${params.toString()}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === "1" && data.geocodes && data.geocodes.length > 0) {
      const geocode = data.geocodes[0]
      const [lng, lat] = geocode.location.split(",").map(Number)

      return {
        name: address,
        address: geocode.formatted_address || address,
        coordinate: { lat, lng },
        formattedAddress: geocode.formatted_address,
        district: geocode.district,
        city: geocode.city || city,
      }
    }

    return null
  } catch (error) {
    console.error(`地理编码失败 (${address}):`, error)
    return null
  }
}

/**
 * 批量地理编码
 */
export async function geocodeAddresses(
  addresses: string[],
  city?: string,
  batchSize: number = 10
): Promise<(LocationInfo | null)[]> {
  const results: (LocationInfo | null)[] = []

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize)

    const batchResults = await Promise.all(
      batch.map((address) => geocodeAddress(address, city))
    )

    results.push(...batchResults)

    // 添加延迟，避免速率限制（高德地图免费版：10次/秒）
    if (i + batchSize < addresses.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  return results
}

/**
 * 从活动标题中提取地点名称
 * 使用规则匹配快速提取
 */
export function extractLocationFromTitle(title: string): string | null {
  // 移除常见前缀
  let location = title
    .replace(/^(午餐|晚餐|早餐|下午茶|夜宵)[：:]\s*/, "")
    .replace(/^(前往|参观|游览|探索|体验|品尝)\s*/, "")
    .replace(/^(在|到|去)\s*/, "")
    .trim()

  // 提取地点模式
  const patterns = [
    /^(.+?)(?:[，,、]|$)/, // 逗号分隔的第一个部分
    /^(.+?)[（(].*?[）)]/, // 括号前的内容
    /^(.+?)(?:[的].*?$)/, // "的"之前的内容
  ]

  for (const pattern of patterns) {
    const match = location.match(pattern)
    if (match && match[1]) {
      location = match[1].trim()
      break
    }
  }

  // 过滤掉太短或明显不是地点的内容
  if (location.length < 2 || location.length > 50) {
    return null
  }

  // 过滤掉常见非地点词汇
  const excludeWords = ["时间", "费用", "门票", "开放", "预约", "预订"]
  if (excludeWords.some((word) => location.includes(word))) {
    return null
  }

  return location
}

/**
 * 使用 LLM 提取地点（降级方案）
 */
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434"
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "qwen2.5:7b"

export async function extractLocationWithLLM(
  activity: {
    title: string
    description?: string
    type?: string
  }
): Promise<string | null> {
  try {
    const prompt = `从以下活动信息中提取地点名称。只返回地点名称，不要其他内容。

活动标题：${activity.title}
活动描述：${activity.description || ""}
活动类型：${activity.type || ""}

请提取地点名称：`

    const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_CHAT_MODEL,
        prompt,
        stream: false,
      }),
    })

    if (!response.ok) return null
    const data = await response.json()
    const location = data.response?.trim() || null
    return location && location.length > 0 && location.length < 50 ? location : null
  } catch (error) {
    console.error("LLM 提取地点失败:", error)
    return null
  }
}

/**
 * 智能提取地点（混合方案）
 */
export async function extractLocation(
  activity: {
    title: string
    description?: string
    type?: string
  },
  destination?: string
): Promise<string | null> {
  // 方案 1: 规则匹配（快速）
  let location = extractLocationFromTitle(activity.title)

  // 如果规则匹配失败，尝试从描述中提取
  if (!location && activity.description) {
    location = extractLocationFromTitle(activity.description)
  }

  // 方案 2: 如果规则匹配失败，使用 LLM（较慢但准确）
  if (!location) {
    location = await extractLocationWithLLM(activity)
  }

  // 如果提取的地点不包含城市，添加目的地城市
  if (location && destination && !location.includes(destination)) {
    // 检查是否需要添加城市前缀
    const needsCityPrefix = !location.match(/^(北京|上海|广州|深圳|杭州|南京|成都|重庆|武汉|西安|苏州|天津|长沙|郑州|青岛|大连|宁波|厦门|福州|合肥|石家庄|太原|哈尔滨|长春|沈阳|昆明|贵阳|南宁|海口|乌鲁木齐|拉萨|银川|西宁|呼和浩特)/)
    
    if (needsCityPrefix) {
      location = `${destination}${location}`
    }
  }

  return location
}

/**
 * 批量提取活动地点
 */
export async function extractLocationsFromActivities(
  activities: Array<{
    title: string
    description?: string
    type?: string
  }>,
  destination?: string
): Promise<Map<string, string | null>> {
  const locationMap = new Map<string, string | null>()

  for (const activity of activities) {
    const key = `${activity.title}-${activity.type}`
    if (!locationMap.has(key)) {
      const location = await extractLocation(activity, destination)
      locationMap.set(key, location)
    }
  }

  return locationMap
}
