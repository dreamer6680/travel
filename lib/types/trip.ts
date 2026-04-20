/** PG 向量库主键引用：地图与聚合查询用，避免仅靠模糊文案地理编码 */
export type ActivityRef = {
  attractionId?: string
  hotelId?: string
  restaurantId?: string
}

/**
 * 行程活动类型（与查表语义绑定，勿写任意中文标签）
 * - recommendation → 景点/推荐 POI，对应 ref.attractionId
 * - restaurant → 餐厅，对应 ref.restaurantId
 * - hotel → 住宿，对应 ref.hotelId
 * - others → 购物、休闲、自由活动、无 ref 的说明性活动
 */
export const TRIP_ACTIVITY_KINDS = ["recommendation", "restaurant", "hotel", "others"] as const
export type TripActivityKind = (typeof TRIP_ACTIVITY_KINDS)[number]

/** UI 展示用（数据层仍存英文 kind） */
export function formatTripActivityType(type: string): string {
  const m: Record<TripActivityKind, string> = {
    recommendation: "推荐景点",
    restaurant: "餐厅",
    hotel: "酒店",
    others: "其他",
  }
  return (m as Record<string, string>)[type] ?? type
}

/** Mongo 中可为 ref-only（无 title/description）；详情由 /api/trips/locations 从 PG 补全 */
export type TripActivityBase = {
  time: string
  /** 新数据请只用 TripActivityKind；历史/Agent 仍可能为中文旧值 */
  type: TripActivityKind | string
  title?: string
  description?: string
  location?: string
  ref?: ActivityRef
  coordinate?: { lat: number; lng: number }
  priceYuan?: number
}

/** 备选景点 */
export type AlternativeAttraction = {
  attractionId: string
  name: string
  type: string
  rating?: number
  location?: string
  description?: string
}

/** 备选酒店 */
export type AlternativeHotel = {
  hotelId: string
  name: string
  rating?: number
  cost?: number
  location?: string
}

/** 备选餐厅 */
export type AlternativeRestaurant = {
  restaurantId: string
  name: string
  type?: string
  rating?: number
  priceYuan?: number
  location?: string
}

/** 用户修改行程时的快速替换候选池 */
export type TripAlternatives = {
  attractions: AlternativeAttraction[]
  hotels: AlternativeHotel[]
  restaurants: AlternativeRestaurant[]
}
