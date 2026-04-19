/** PG 向量库主键引用：地图与聚合查询用，避免仅靠模糊文案地理编码 */
export type ActivityRef = {
  attractionId?: string
  hotelId?: string
  restaurantId?: string
}

export type TripActivityBase = {
  time: string
  title: string
  type: string
  description: string
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
