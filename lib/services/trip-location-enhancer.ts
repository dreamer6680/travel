/**
 * 行程地点增强服务
 * 从行程活动中提取地点信息并获取坐标
 */

import { extractLocationsFromActivities, geocodeAddresses, LocationInfo } from "./location-service"

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

export interface DayWithLocations {
  day: number
  title: string
  activities: ActivityWithLocation[]
}

export interface TripWithLocations {
  destination: string
  days: DayWithLocations[]
  allLocations: LocationInfo[]
}

/**
 * 增强行程数据，添加地点信息
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
  }
): Promise<TripWithLocations> {
  try {
    // 1. 提取所有活动的地点名称
    const allActivities = trip.days.flatMap((day) => day.activities)
    const locationMap = await extractLocationsFromActivities(allActivities, trip.destination)

    // 2. 收集所有唯一的地点名称
    const uniqueLocations = Array.from(new Set(Array.from(locationMap.values()).filter(Boolean))) as string[]

    // 3. 批量地理编码
    const locationInfos = await geocodeAddresses(uniqueLocations, trip.destination)

    // 4. 创建地点名称到 LocationInfo 的映射
    const locationInfoMap = new Map<string, LocationInfo>()
    uniqueLocations.forEach((location, index) => {
      if (locationInfos[index]) {
        locationInfoMap.set(location, locationInfos[index]!)
      }
    })

    // 5. 增强活动数据
    const enhancedDays: DayWithLocations[] = trip.days.map((day) => ({
      ...day,
      activities: day.activities.map((activity) => {
        const activityKey = `${activity.title}-${activity.type}`
        const locationName = locationMap.get(activityKey) || activity.location
        const locationInfo = locationName ? locationInfoMap.get(locationName) : undefined

        return {
          ...activity,
          location: locationName || undefined,
          coordinate: locationInfo?.coordinate,
          locationInfo: locationInfo,
        }
      }),
    }))

    // 6. 收集所有有效的地点信息
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
