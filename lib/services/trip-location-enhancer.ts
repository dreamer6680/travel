/**
 * 行程地点增强服务
 * 从行程活动中提取地点信息并获取坐标
 * 优先从景点数据库中匹配，降级使用地理编码 API
 * 支持高德公共交通路线规划（按天、按顺序规划相邻景点间公交方案）
 */

import { extractLocationsFromActivities, geocodeAddresses, LocationInfo } from "./location-service"
import { query } from "../db-pg"
import { getTransitRoute, type TransitRouteInfo } from "./amap-transit-service"

export interface ActivityWithLocation {
  time: string
  title: string
  type: string
  description: string
  location?: string
  coordinate?: {
    lat: number
    lng: number
  }
  locationInfo?: LocationInfo
}

/** 相邻两活动之间的公交路线（高德公共交通规划结果） */
export interface TransitSegmentBetweenActivities {
  fromTitle: string
  toTitle: string
  fromIndex: number
  toIndex: number
  route: TransitRouteInfo
}

export interface DayWithLocations {
  day: number
  title: string
  activities: ActivityWithLocation[]
  /** 当天相邻有坐标活动之间的公交路线规划结果（高德 API） */
  transitSegments?: TransitSegmentBetweenActivities[]
}

export interface TripWithLocations {
  destination: string
  days: DayWithLocations[]
  allLocations: LocationInfo[]
}

/**
 * 从景点数据库中匹配活动标题，获取坐标
 */
async function getCoordinatesFromAttractions(
  activities: Array<{ title: string; location?: string }>,
  destination: string
): Promise<Map<string, LocationInfo>> {
  const locationInfoMap = new Map<string, LocationInfo>()
  
  try {
    // 为每个活动尝试匹配景点
    for (const activity of activities) {
      // 优先使用 location 字段，如果没有则从 title 提取
      const searchText = activity.location || activity.title
      
      // 提取关键词（去除城市前缀和常见动词）
      let keywords = searchText
        .replace(new RegExp(`^${destination}`, 'g'), '')
        .replace(/^(前往|参观|游览|品尝|体验|探索|抵达|入住|观光|深度游|全景游览|赏景|晚餐|美食体验|购物|休闲|返程|及|和)/g, '')
        .trim()
      
      // 提取主要景点名称（去除描述性词汇）
      const mainKeywords = keywords
        .split(/[，,、及和]/)[0] // 取第一个关键词
        .replace(/(步行街|CBD|观光|深度游|全景游览|赏景|晚餐|美食体验|购物|休闲|返程|机场|酒店|博物馆|公园|长城|大学|美食街)/g, '')
        .trim()
      
      if (mainKeywords.length < 2) {
        continue
      }

      try {
        // 尝试多个匹配策略
        const searchPatterns = [
          mainKeywords, // 主要关键词
          keywords.split(/[，,、]/)[0], // 第一个完整短语
        ].filter(Boolean)
          .filter(pattern => pattern.length >= 2)

        for (const searchPattern of searchPatterns) {
          const result = await query(`
            SELECT 
              name,
              location,
              latitude,
              longitude,
              coordinate_type
            FROM attraction_vectors
            WHERE 
              (name ILIKE $1 OR description ILIKE $1)
              AND (latitude IS NOT NULL AND longitude IS NOT NULL)
            ORDER BY 
              CASE 
                WHEN name ILIKE $1 THEN 1
                WHEN description ILIKE $1 THEN 2
                ELSE 3
              END
            LIMIT 1
          `, [`%${searchPattern}%`])

          if (result.rows.length > 0) {
            const attraction = result.rows[0]
            
            if (attraction.latitude && attraction.longitude) {
              // 转换坐标系（如果需要）
              let lat = Number(attraction.latitude)
              let lng = Number(attraction.longitude)
              
              // 如果是 BD09 坐标系，可能需要转换（这里先直接使用）
              // TODO: 如果需要，可以添加坐标系转换逻辑
              
              console.log(`✅ 从数据库匹配到坐标: ${activity.title} -> ${attraction.name} (${lat}, ${lng})`)
              
              locationInfoMap.set(activity.title, {
                name: attraction.name || activity.title,
                address: attraction.location || '',
                coordinate: { lat, lng },
                formattedAddress: attraction.location || '',
              })
              break // 找到匹配就停止
            }
          }
        }
        
        if (!locationInfoMap.has(activity.title)) {
          console.log(`⚠️  未从数据库匹配到坐标: ${activity.title} (搜索词: ${mainKeywords})`)
        }
      } catch (error) {
        console.warn(`从数据库获取坐标失败 (${activity.title}):`, error)
      }
    }
  } catch (error) {
    console.warn("从景点数据库匹配坐标失败:", error)
  }

  return locationInfoMap
}

/**
 * 增强行程数据，添加地点信息
 * 若传入 selectedHotel 且含经纬度，会在每天首尾注入「从酒店出发」「返回酒店」，并参与公交规划
 */
export async function enhanceTripWithLocations(
  trip: {
    destination: string
    days: Array<{
      day: number
      title: string
      activities: Array<{
        time: string
        title: string
        type: string
        description: string
        location?: string
      }>
    }>
    selectedHotel?: { name: string; cost: number; latitude?: number; longitude?: number }
  }
): Promise<TripWithLocations> {
  try {
    // 若有选定酒店且含坐标，每天首尾注入酒店起止点，便于规划「酒店↔景点」公交
    let daysToProcess = trip.days
    if (
      trip.selectedHotel &&
      trip.selectedHotel.latitude != null &&
      trip.selectedHotel.longitude != null
    ) {
      const hotelName = trip.selectedHotel.name
      const hotelAct = (time: string, title: string) => ({
        time,
        title,
        type: "酒店",
        description: hotelName,
        location: hotelName,
      })
      daysToProcess = trip.days.map((day) => ({
        ...day,
        activities: [
          hotelAct("08:00", "从酒店出发"),
          ...day.activities,
          hotelAct("20:00", "返回酒店"),
        ],
      }))
    }

    // 1. 提取所有活动的地点名称
    const allActivities = daysToProcess.flatMap((day) => day.activities)
    const locationMap = await extractLocationsFromActivities(allActivities, trip.destination)

    // 2. 收集所有唯一的地点名称
    const uniqueLocations = Array.from(new Set(Array.from(locationMap.values()).filter(Boolean))) as string[]

    // 3. 优先从景点数据库获取坐标（使用完整的活动信息）
    const dbLocationMap = await getCoordinatesFromAttractions(allActivities, trip.destination)
    
    // 4. 对于没有从数据库获取到坐标的地点，使用地理编码 API
    const locationsNeedingGeocode = uniqueLocations.filter(loc => !dbLocationMap.has(loc))
    const geocodedLocations = await geocodeAddresses(locationsNeedingGeocode, trip.destination)

    // 5. 合并所有地点信息
    const locationInfoMap = new Map<string, LocationInfo>()
    
    // 添加从数据库获取的坐标
    dbLocationMap.forEach((info, key) => {
      locationInfoMap.set(key, info)
    })
    
    // 添加地理编码获取的坐标
    uniqueLocations.forEach((location, index) => {
      const locationIndex = locationsNeedingGeocode.indexOf(location)
      if (locationIndex >= 0 && geocodedLocations[locationIndex]) {
        locationInfoMap.set(location, geocodedLocations[locationIndex]!)
      }
    })

    // 选定酒店的坐标（用于「从酒店出发」「返回酒店」）
    if (
      trip.selectedHotel &&
      trip.selectedHotel.latitude != null &&
      trip.selectedHotel.longitude != null
    ) {
      locationInfoMap.set(trip.selectedHotel.name, {
        name: trip.selectedHotel.name,
        address: trip.selectedHotel.name,
        coordinate: {
          lat: trip.selectedHotel.latitude,
          lng: trip.selectedHotel.longitude,
        },
      })
    }

    // 5. 增强活动数据
    const enhancedDays: DayWithLocations[] = daysToProcess.map((day) => ({
      ...day,
      activities: day.activities.map((activity) => {
        const activityKey = `${activity.title}-${activity.type}`
        const locationName = locationMap.get(activityKey) || activity.location

        // 优先从数据库匹配的坐标（通过活动标题）
        let locationInfo = dbLocationMap.get(activity.title)

        // 如果没有，尝试通过 location 字段匹配
        if (!locationInfo && locationName) {
          // 先尝试从数据库匹配 locationName
          for (const [key, info] of dbLocationMap.entries()) {
            if (locationName.includes(key) || key.includes(locationName)) {
              locationInfo = info
              break
            }
          }

          // 如果还是没有，使用地理编码的结果
          if (!locationInfo) {
            locationInfo = locationInfoMap.get(locationName)
          }
        }

        return {
          ...activity,
          location: locationName || activity.location || undefined,
          coordinate: locationInfo?.coordinate,
          locationInfo: locationInfo,
        }
      }),
    }))

    // 6. 按天调用高德公共交通路线规划（相邻有坐标的活动之间）
    const city = trip.destination || ""
    for (const day of enhancedDays) {
      const withCoord = day.activities
        .map((a, idx) => ({ activity: a, index: idx }))
        .filter(({ activity }) => activity.coordinate?.lat != null && activity.coordinate?.lng != null)
      const segments: TransitSegmentBetweenActivities[] = []
      for (let i = 0; i < withCoord.length - 1; i++) {
        const from = withCoord[i].activity.coordinate!
        const to = withCoord[i + 1].activity.coordinate!
        const route = await getTransitRoute(
          { lng: from.lng, lat: from.lat },
          { lng: to.lng, lat: to.lat },
          city
        )
        if (route) {
          segments.push({
            fromTitle: withCoord[i].activity.title,
            toTitle: withCoord[i + 1].activity.title,
            fromIndex: withCoord[i].index,
            toIndex: withCoord[i + 1].index,
            route,
          })
        }
        if (i < withCoord.length - 2) {
          await new Promise((r) => setTimeout(r, 200))
        }
      }
      day.transitSegments = segments.length > 0 ? segments : undefined
    }

    // 7. 收集所有有效的地点信息
    const allLocations = Array.from(locationInfoMap.values())

    return {
      destination: trip.destination,
      days: enhancedDays,
      allLocations,
    }
  } catch (error) {
    console.error("增强行程地点信息失败:", error)
    // 返回原始数据，不包含地点信息
    return {
      destination: trip.destination,
      days: trip.days.map((day) => ({
        ...day,
        activities: day.activities.map((activity) => ({
          ...activity,
        })),
      })),
      allLocations: [],
    }
  }
}

/**
 * 按天组织地点数据（用于地图展示）
 */
export function organizeLocationsByDay(
  tripWithLocations: TripWithLocations
): Array<{
  day: number
  dayTitle: string
  locations: Array<{
    name: string
    coordinate: { lat: number; lng: number }
    activity: ActivityWithLocation
    order: number
  }>
}> {
  return tripWithLocations.days.map((day) => {
    const locations = day.activities
      .map((activity, index) => ({
        name: activity.location || activity.title,
        coordinate: activity.coordinate!,
        activity,
        order: index,
      }))
      .filter((item) => item.coordinate) // 只保留有坐标的活动

    return {
      day: day.day,
      dayTitle: day.title,
      locations,
    }
  })
}

/**
 * 获取所有地点的边界（用于地图自适应缩放）
 */
export function getLocationsBounds(
  locations: Array<{ coordinate: { lat: number; lng: number } }>
): {
  north: number
  south: number
  east: number
  west: number
  center: { lat: number; lng: number }
} | null {
  if (locations.length === 0) {
    return null
  }

  const lats = locations.map((loc) => loc.coordinate.lat)
  const lngs = locations.map((loc) => loc.coordinate.lng)

  const north = Math.max(...lats)
  const south = Math.min(...lats)
  const east = Math.max(...lngs)
  const west = Math.min(...lngs)

  return {
    north,
    south,
    east,
    west,
    center: {
      lat: (north + south) / 2,
      lng: (east + west) / 2,
    },
  }
}
