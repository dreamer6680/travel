/**
 * 高德地图公共交通路线规划服务
 * 使用 Web 服务 API：公交路径规划（市内公交换乘/跨城公交）
 * @see https://lbs.amap.com/api/webservice/guide/api/direction#transit
 */

export interface TransitSegmentStep {
  type: "walk" | "bus" | "metro" | "railway"
  instruction?: string
  name?: string
  departureStop?: string
  arrivalStop?: string
  distance?: number
  duration?: number
}

export interface TransitRouteInfo {
  duration: number
  distance: number
  cost: string
  walkingDistance: number
  segments: TransitSegmentStep[]
  raw?: unknown
}

interface AmapTransitResponse {
  status: string
  info: string
  count?: string
  route?: {
    origin: { location: string }
    destination: { location: string }
    distance: string
    taxi_cost: string
    transits?: Array<{
      cost: string
      duration: string
      nightflag: string
      walking_distance: string
      segments: Array<{
        walking?: {
          origin: string
          destination: string
          distance: string
          duration: string
          steps: Array<{ instruction: string; road: string; distance: string; duration: string }>
        }
        bus?: {
          departure_stop: { name: string; id: string; location: string }
          arrival_stop: { name: string; id: string; location: string }
          name: string
          id: string
          type: string
          distance: string
          duration: string
          via_stops: Array<{ name: string; id: string; location: string }>
        }
        railway?: unknown
        entrance?: unknown
        exit?: unknown
      }>
    }>
  }
}

/**
 * 调用高德公交路径规划 API（市内公交换乘）
 * @param origin 起点 { lng, lat }（高德坐标系 GCJ-02）
 * @param destination 终点 { lng, lat }
 * @param city 城市名称或 citycode，如 "北京" 或 "010"
 */
export async function getTransitRoute(
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
  city: string
): Promise<TransitRouteInfo | null> {
  const apiKey =
    process.env.AMAP_WEB_SERVICE_KEY || process.env.NEXT_PUBLIC_AMAP_KEY
  if (!apiKey) {
    console.warn("高德地图 API Key 未设置，无法进行公交路线规划")
    return null
  }

  const originStr = `${origin.lng},${origin.lat}`
  const destStr = `${destination.lng},${destination.lat}`

  const params = new URLSearchParams({
    key: apiKey,
    origin: originStr,
    destination: destStr,
    city: city,
    output: "json",
    extensions: "base",
    strategy: "0",
  })

  const url = `https://restapi.amap.com/v3/direction/transit/integrated?${params.toString()}`

  try {
    const response = await fetch(url)
    const data: AmapTransitResponse = await response.json()

    if (data.status !== "1" || !data.route?.transits?.length) {
      return null
    }

    const transit = data.route.transits[0]
    const steps: TransitSegmentStep[] = []

    for (const seg of transit.segments || []) {
      if (seg.walking) {
        const w = seg.walking
        steps.push({
          type: "walk",
          instruction: w.steps?.[0]?.instruction,
          distance: parseInt(w.distance || "0", 10),
          duration: parseInt(w.duration || "0", 10),
        })
      }
      if (seg.bus) {
        const b = seg.bus
        const busType =
          (b.type || "").indexOf("地铁") >= 0 ? "metro" : "bus"
        steps.push({
          type: busType,
          name: b.name,
          departureStop: b.departure_stop?.name,
          arrivalStop: b.arrival_stop?.name,
          distance: parseInt(b.distance || "0", 10),
          duration: parseInt(b.duration || "0", 10),
        })
      }
      if (seg.railway) {
        steps.push({ type: "railway", instruction: "火车" })
      }
    }

    return {
      duration: parseInt(transit.duration || "0", 10),
      distance:
        parseInt(data.route.distance || "0", 10) +
        parseInt(transit.walking_distance || "0", 10),
      cost: transit.cost || "0",
      walkingDistance: parseInt(transit.walking_distance || "0", 10),
      segments: steps,
    }
  } catch (error) {
    console.error("高德公交路线规划请求失败:", error)
    return null
  }
}
