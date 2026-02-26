/**
 * OpenRouteService 路线规划服务
 * 用于优化多个景点之间的路线顺序
 */

export interface Coordinate {
  lat: number
  lng: number
}

export interface AttractionWithLocation {
  id: number
  name: string
  location: string
  coordinates?: Coordinate
  // 从数据库获取的坐标信息（优先使用）
  coordinate?: {
    latitude: number
    longitude: number
    coordinateType?: string // 'BD09' | 'WGS84' | 'GCJ02'
  }
}

export interface RoutePlan {
  optimizedOrder: number[] // 优化后的景点顺序（索引数组）
  distances: number[] // 每段距离（公里）
  durations: number[] // 每段耗时（分钟）
  totalDistance: number // 总距离（公里）
  totalDuration: number // 总耗时（分钟）
  route: Array<{
    from: number
    to: number
    distance: number
    duration: number
    geometry?: any
  }>
}

/**
 * 将数据库中的坐标转换为 Coordinate 格式
 * 注意：如果坐标是 BD09（百度坐标系），可能需要转换为 WGS84
 */
function convertCoordinateToStandard(
  coordinate: {
    latitude: number
    longitude: number
    coordinateType?: string
  }
): Coordinate {
  // 目前直接使用，如果后续需要坐标系转换，可以在这里添加转换逻辑
  // BD09 -> WGS84 的转换需要专门的算法
  return {
    lat: coordinate.latitude,
    lng: coordinate.longitude,
  }
}

/**
 * 从地址获取坐标（地理编码）- 降级方案
 * 注意：OpenRouteService 免费版需要 API Key，但也可以使用其他地理编码服务
 */
async function geocodeAddress(
  address: string
): Promise<Coordinate | null> {
  try {
    // 使用 OpenRouteService 地理编码 API
    const apiKey = process.env.OPENROUTESERVICE_API_KEY || ""
    const url = `https://api.openrouteservice.org/geocoding/search?api_key=${apiKey}&text=${encodeURIComponent(address)}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].geometry.coordinates
      return { lat, lng }
    }

    return null
  } catch (error) {
    console.error(`地理编码失败 (${address}):`, error)
    return null
  }
}

/**
 * 批量获取坐标
 */
async function geocodeAddresses(
  addresses: string[]
): Promise<(Coordinate | null)[]> {
  const coordinates: (Coordinate | null)[] = []

  for (const address of addresses) {
    const coord = await geocodeAddress(address)
    coordinates.push(coord)
    // 添加延迟，避免速率限制
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  return coordinates
}

/**
 * 计算两点之间的距离和时间（使用 OpenRouteService Directions API）
 */
async function calculateRoute(
  from: Coordinate,
  to: Coordinate,
  profile: "driving-car" | "foot-walking" | "cycling-regular" = "driving-car"
): Promise<{ distance: number; duration: number }> {
  try {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY || ""
    const url = `https://api.openrouteservice.org/v2/directions/${profile}`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { Authorization: apiKey }),
      },
      body: JSON.stringify({
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
      }),
    })

    const data = await response.json()

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0]
      const distance = route.summary.distance / 1000 // 转换为公里
      const duration = route.summary.duration / 60 // 转换为分钟
      return { distance, duration }
    }

    // 降级方案：使用 Haversine 公式计算直线距离
    return calculateHaversineDistance(from, to)
  } catch (error) {
    console.error("计算路线失败:", error)
    // 降级方案
    return calculateHaversineDistance(from, to)
  }
}

/**
 * 使用 Haversine 公式计算两点间的直线距离
 */
function calculateHaversineDistance(
  from: Coordinate,
  to: Coordinate
): { distance: number; duration: number } {
  const R = 6371 // 地球半径（公里）
  const dLat = ((to.lat - from.lat) * Math.PI) / 180
  const dLon = ((to.lng - from.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  // 估算时间（假设平均速度 30 km/h）
  const duration = (distance / 30) * 60

  return { distance, duration }
}

/**
 * 使用 OpenRouteService Optimization API 优化路线
 * 注意：优化 API 需要付费版，这里实现一个简化版本
 */
async function optimizeRouteWithAPI(
  coordinates: Coordinate[]
): Promise<number[]> {
  try {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY
    if (!apiKey) {
      // 如果没有 API Key，使用贪心算法
      return optimizeRouteGreedy(coordinates)
    }

    const url = "https://api.openrouteservice.org/v2/optimization"

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        jobs: coordinates.map((coord, idx) => ({
          id: idx,
          location: [coord.lng, coord.lat],
        })),
        vehicles: [
          {
            id: 1,
            profile: "driving-car",
            start: [coordinates[0].lng, coordinates[0].lat],
            end: [coordinates[0].lng, coordinates[0].lat],
          },
        ],
      }),
    })

    const data = await response.json()

    if (data.routes && data.routes.length > 0) {
      return data.routes[0].steps.map((step: any) => step.id)
    }

    // 降级方案
    return optimizeRouteGreedy(coordinates)
  } catch (error) {
    console.error("API 路线优化失败，使用贪心算法:", error)
    return optimizeRouteGreedy(coordinates)
  }
}

/**
 * 贪心算法优化路线（最近邻算法）
 */
function optimizeRouteGreedy(coordinates: Coordinate[]): number[] {
  if (coordinates.length <= 1) {
    return [0]
  }

  const visited = new Set<number>()
  const order: number[] = []
  let current = 0 // 从第一个点开始

  order.push(current)
  visited.add(current)

  while (visited.size < coordinates.length) {
    let nearest = -1
    let minDistance = Infinity

    for (let i = 0; i < coordinates.length; i++) {
      if (!visited.has(i)) {
        const distance = calculateHaversineDistance(
          coordinates[current],
          coordinates[i]
        ).distance

        if (distance < minDistance) {
          minDistance = distance
          nearest = i
        }
      }
    }

    if (nearest !== -1) {
      order.push(nearest)
      visited.add(nearest)
      current = nearest
    } else {
      break
    }
  }

  return order
}

/**
 * 规划多个景点的最优路线
 */
export async function planRoute(
  attractions: AttractionWithLocation[],
  options: {
    startLocation?: Coordinate
    endLocation?: Coordinate
    profile?: "driving-car" | "foot-walking" | "cycling-regular"
    optimize?: boolean
  } = {}
): Promise<RoutePlan> {
  const { profile = "driving-car", optimize = true } = options

  try {
    // 1. 优先使用景点数据中已有的坐标，如果没有再尝试地理编码
    const validAttractions: AttractionWithLocation[] = []
    const validCoordinates: Coordinate[] = []

    for (const attraction of attractions) {
      let coordinate: Coordinate | null = null

      // 优先使用已有的 coordinates 字段
      if (attraction.coordinates) {
        coordinate = attraction.coordinates
      }
      // 其次使用从数据库获取的 coordinate 字段（需要转换坐标系）
      else if (attraction.coordinate) {
        // 将数据库中的坐标转换为 Coordinate 格式
        coordinate = convertCoordinateToStandard(attraction.coordinate)
      }
      // 降级方案：如果没有坐标，尝试地理编码
      else {
        console.log(`景点 ${attraction.name} 没有坐标信息，尝试地理编码...`)
        coordinate = await geocodeAddress(attraction.location)
        // 添加延迟，避免速率限制
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      if (coordinate) {
        validAttractions.push({
          ...attraction,
          coordinates: coordinate,
        })
        validCoordinates.push(coordinate)
      } else {
        console.warn(`无法获取景点 ${attraction.name} 的坐标，跳过`)
      }
    }

    if (validCoordinates.length === 0) {
      throw new Error("无法获取任何景点的坐标")
    }

    // 3. 优化路线顺序
    let optimizedOrder: number[]
    if (optimize && validCoordinates.length > 2) {
      optimizedOrder = await optimizeRouteWithAPI(validCoordinates)
    } else {
      optimizedOrder = validCoordinates.map((_, idx) => idx)
    }

    // 4. 计算每段距离和时间
    const distances: number[] = []
    const durations: number[] = []
    const route: RoutePlan["route"] = []

    for (let i = 0; i < optimizedOrder.length - 1; i++) {
      const fromIdx = optimizedOrder[i]
      const toIdx = optimizedOrder[i + 1]

      const from = validCoordinates[fromIdx]
      const to = validCoordinates[toIdx]

      const { distance, duration } = await calculateRoute(from, to, profile)

      distances.push(distance)
      durations.push(duration)
      route.push({
        from: validAttractions[fromIdx].id,
        to: validAttractions[toIdx].id,
        distance,
        duration,
      })
    }

    // 5. 计算总计
    const totalDistance = distances.reduce((a, b) => a + b, 0)
    const totalDuration = durations.reduce((a, b) => a + b, 0)

    return {
      optimizedOrder: optimizedOrder.map((idx) => validAttractions[idx].id),
      distances,
      durations,
      totalDistance,
      totalDuration,
      route,
    }
  } catch (error) {
    console.error("路线规划失败:", error)
    // 降级方案：返回原始顺序
    return {
      optimizedOrder: attractions.map((_, idx) => idx),
      distances: [],
      durations: [],
      totalDistance: 0,
      totalDuration: 0,
      route: [],
    }
  }
}

/**
 * 简化版路线规划（不需要坐标，仅基于位置名称）
 */
export async function planRouteSimple(
  attractions: AttractionWithLocation[]
): Promise<RoutePlan> {
  // 简化版本：不进行实际路线优化，只返回原始顺序
  // 可以后续根据实际需求优化
  return {
    optimizedOrder: attractions.map((_, idx) => idx),
    distances: [],
    durations: [],
    totalDistance: 0,
    totalDuration: 0,
    route: [],
  }
}
