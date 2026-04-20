/**
 * 活动语义：`from` + `id` 指向 PG POI；`others` 可无 id，用文案字段。
 * 不兼容旧字段 `type` / `ref`。
 */

export type TransitRoute = {
  duration: number
  walking_distance: number
  cost: number
  segments: Array<{ type: string; name: string }>
  /** 高德 Web 服务 API 返回的完整路径坐标（GCJ-02），后端生成时写入 */
  polyline: Array<{ lat: number; lng: number }>
}

export type TransitSegment = {
  fromTitle: string
  toTitle: string
  fromIndex: number
  toIndex: number
  route: TransitRoute
}

/** 后端一次性 enrichment 后写回 Mongo 的天数结构，含坐标与路线 polyline */
export type EnrichedDay = {
  day: number
  title: string
  activities: TripActivityResolved[]
  transitSegments?: TransitSegment[]
}
export const TRIP_ACTIVITY_KINDS = ["recommendation", "restaurant", "hotel", "others"] as const
export type TripActivityFrom = (typeof TRIP_ACTIVITY_KINDS)[number]

/** UI 展示用 */
export function formatTripActivityType(from: string): string {
  const m: Record<TripActivityFrom, string> = {
    recommendation: "推荐景点",
    restaurant: "餐厅",
    hotel: "酒店",
    others: "其他",
  }
  return (m as Record<string, string>)[from] ?? from
}

/** Mongo / API 持久化活动 */
export type TripActivityStored = {
  time: string
  from: TripActivityFrom
  /** PG 主键；others 可无 */
  id?: string
  title?: string
  description?: string
  location?: string
  priceYuan?: number
  coordinate?: { lat: number; lng: number }
}

export type AlternativeAttraction = {
  attractionId: string
  name: string
  type: string
  rating?: number
  location?: string
  description?: string
}

export type AlternativeHotel = {
  hotelId: string
  name: string
  rating?: number
  cost?: number
  location?: string
}

export type AlternativeRestaurant = {
  restaurantId: string
  name: string
  type?: string
  rating?: number
  priceYuan?: number
  location?: string
}

export type TripAlternatives = {
  attractions: AlternativeAttraction[]
  hotels: AlternativeHotel[]
  restaurants: AlternativeRestaurant[]
}

/** API 响应层 / enrichedDays 中的活动：坐标与 PG 字段已补全 */
export type TripActivityResolved = TripActivityStored & {
  title?: string
  description?: string
  location?: string
  coordinate?: { lat: number; lng: number }
}

/** 根文档形状（与 Agent / Mongo 对齐） */
export type TripDocument = {
  id: string
  userId?: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget: number
  travelStyle: string
  status: string
  highlights: string[]
  days: Array<{
    day: number
    title: string
    activities: TripActivityStored[]
  }>
  recommendations: Array<{ name: string; type: string; attractionId?: string; restaurantId?: string }>
  practicalInfo: {
    transportation: Array<{ name: string; cost: number; icon: string }>
    accommodation: Array<{ name: string; cost: number; icon: string; totalCost?: number; nights?: number; hotelId?: string }>
    food?: Array<{ name: string; cost: number; icon: string }>
    tips: string[]
  }
  estimatedCost?: number
  selectedHotelId?: string
  hotelNightlyCost?: number
  hotelTotalCost?: number
  alternatives?: TripAlternatives
  /**
   * 生成后一次性写入：仅存高德路线规划结果（polyline），按天索引。
   * activities 仍只保留 from+id，坐标/标题在 GET 时由 Python 按需解析。
   */
  routeSegments?: Record<string, TransitSegment[]>
  createdAt?: string
  updatedAt?: string
}

/** GET /api/trips/:id 的响应体（不写回 Mongo） */
export type TripDetailResponse = Omit<TripDocument, "routeSegments"> & {
  /** Python 按需解析后的天数，含坐标和 transitSegments（路线来自 routeSegments 缓存） */
  days: EnrichedDay[]
  allLocations: Array<{ name: string; coordinate: { lat: number; lng: number } }>
  selectedHotel?: SelectedHotelView
}

/** 酒店详情视图（PG 补全后，随 enrichedDays 一起缓存到 Mongo） */
export type SelectedHotelView = {
  hotelId: string
  name?: string
  cost?: number
  rating?: number
  priceDisplay?: string
  totalCost?: number
  address?: string
  positionDesc?: string
  imageUrl?: string
}
