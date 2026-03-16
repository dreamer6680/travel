import { enhanceUserInput, generateTripItinerary, EnhancedUserInput } from "@/lib/services/llm-service"
import { PromptEnhancementService } from "@/lib/services/prompt-enhancement-service"
import { VectorSearchService } from "./vector-search.service"
import { planRoute, AttractionWithLocation } from "@/lib/services/route-planning-service"
import { searchHotelsByLocation } from "@/lib/services/knowledge-base-service"

export interface TripGenerationInput {
  destination?: string
  startDate?: string
  endDate?: string
  travelers?: number
  budget?: number
  travelStyle?: string
  interests?: string
}

export interface TripGenerationResult {
  trip: any
  matchedAttractions: Array<{
    id: number
    name: string
    location: string
    type: string
    description: string
    rating: number
    similarity: number
  }>
  routePlan?: {
    optimizedOrder: number[]
    totalDistance: number
    totalDuration: number
  }
}

/**
 * 智能旅行生成工作流服务
 * 完整的工作流程：
 * 1. 完善用户描述
 * 2. 生成用户偏好向量
 * 3. 向量相似度匹配景点
 * 4. 路线规划
 * 5. 生成最终行程
 */
export class TripGenerationWorkflowService {
  private promptEnhancementService: PromptEnhancementService
  private vectorSearchService: VectorSearchService

  constructor() {
    this.promptEnhancementService = new PromptEnhancementService()
    this.vectorSearchService = new VectorSearchService()
  }

  /**
   * 执行完整的工作流
   */
  async generateTrip(input: TripGenerationInput): Promise<TripGenerationResult> {
    try {
      console.log("🚀 开始生成旅行行程...")

      // 步骤 1: 完善用户描述
      console.log("📝 步骤 1: 完善用户描述...")
      const enhancedInput = await this.promptEnhancementService.enhanceInput(input)
      console.log("✅ 用户描述已完善:", enhancedInput.destination)

      // 步骤 2: 生成用户偏好向量并匹配景点
      console.log("🔍 步骤 2: 向量相似度匹配景点...")
      const preferences = this.promptEnhancementService.buildPreferencesForSearch(enhancedInput)
      const filters = this.promptEnhancementService.extractFilters(enhancedInput)

      const matchedAttractions = await this.vectorSearchService.searchByPreferences(
        preferences,
        {
          limit: 30, // 获取更多候选，后续会筛选
          similarityThreshold: 0.65,
          ...filters,
          useMultiDimensional: true, // 使用多维度匹配
        }
      )

      console.log(`✅ 匹配到 ${matchedAttractions.length} 个景点`)

      if (matchedAttractions.length === 0) {
        throw new Error("未找到匹配的景点，请调整搜索条件")
      }

      // 步骤 2.5: 按目的地匹配推荐酒店（用于住宿推荐）
      let matchedHotels: Array<{ name: string; location: string | null; star: number; rating: number | null; priceDisplay: string | null; priceYuan: number | null }> = []
      try {
        matchedHotels = await searchHotelsByLocation(enhancedInput.destination, 8)
        if (matchedHotels.length > 0) {
          console.log(`✅ 匹配到 ${matchedHotels.length} 家推荐酒店`)
        }
      } catch (e) {
        console.warn("⚠️  查询推荐酒店失败，继续生成行程:", e)
      }

      // 步骤 3: 路线规划（可选）
      console.log("🗺️  步骤 3: 路线规划...")
      let routePlan
      try {
        // 调试：检查第一个景点的数据结构
        if (matchedAttractions.length > 0) {
          const first = matchedAttractions[0]
          console.log("🔍 第一个景点数据结构:", {
            id: first.attraction_id,
            name: first.name,
            latitude: first.latitude,
            longitude: first.longitude,
            coordinate_type: first.coordinate_type,
            hasMetadataCoordinate: !!first.metadata?.coordinate,
            metadataCoordinate: first.metadata?.coordinate,
          })
        }
        
        const attractionsForRoute: AttractionWithLocation[] = matchedAttractions
          .slice(0, 10) // 限制数量，避免 API 调用过多
          .map((attr) => {
            const attraction: AttractionWithLocation = {
              id: attr.attraction_id,
              name: attr.name,
              location: attr.location || "",
            }
            
            // 优先使用数据库中的坐标字段
            if (attr.latitude != null && attr.longitude != null) {
              attraction.coordinate = {
                latitude: Number(attr.latitude),
                longitude: Number(attr.longitude),
                coordinateType: attr.coordinate_type || 'BD09',
              }
              console.log(`✅ 使用数据库坐标: ${attr.name} (${attr.latitude}, ${attr.longitude})`)
            }
            // 降级：从 metadata 中获取坐标
            else if (attr.metadata?.coordinate) {
              const coord = attr.metadata.coordinate
              // 检查坐标对象的结构
              const lat = coord.latitude ?? coord.lat
              const lng = coord.longitude ?? coord.lng
              
              if (lat != null && lng != null) {
                attraction.coordinate = {
                  latitude: Number(lat),
                  longitude: Number(lng),
                  coordinateType: coord.coordinateType || coord.coordinate_type || 'BD09',
                }
                console.log(`✅ 使用 metadata 坐标: ${attr.name} (${lat}, ${lng})`)
              } else {
                console.warn(`⚠️  metadata.coordinate 格式不正确:`, JSON.stringify(coord))
              }
            }
            
            if (!attraction.coordinate) {
              console.warn(`⚠️  景点 ${attr.name} 没有坐标信息`)
            }
            
            return attraction
          })

        console.log("attractionsForRoute", attractionsForRoute)

        routePlan = await planRoute(attractionsForRoute, {
          profile: "driving-car",
          optimize: true,
        })
        console.log("✅ 路线规划完成")
      } catch (error) {
        console.warn("⚠️  路线规划失败，继续使用原始顺序:", error)
        routePlan = undefined
      }

      // 步骤 4: 生成最终行程
      console.log("✍️  步骤 4: 生成详细行程...")
      const selectedAttractions = matchedAttractions.slice(0, 15).map((attr) => ({
        name: attr.name,
        location: attr.location || "",
        type: attr.type || "",
        description: attr.description || "",
        rating: attr.rating || 0,
      }))

      const trip = await generateTripItinerary(
        enhancedInput,
        selectedAttractions,
        routePlan
          ? {
              optimizedOrder: routePlan.optimizedOrder,
              distances: routePlan.distances,
              durations: routePlan.durations,
            }
          : undefined,
        matchedHotels.length > 0 ? matchedHotels : undefined
      )

      console.log("✅ 行程生成完成")

      return {
        trip: {
          ...trip,
          id: Math.random().toString(36).substring(2, 15),
        },
        matchedAttractions: matchedAttractions.slice(0, 15).map((attr) => ({
          id: attr.attraction_id,
          name: attr.name,
          location: attr.location || "",
          type: attr.type || "",
          description: attr.description || "",
          rating: attr.rating || 0,
          similarity: attr.similarity,
        })),
        routePlan: routePlan
          ? {
              optimizedOrder: routePlan.optimizedOrder,
              totalDistance: routePlan.totalDistance,
              totalDuration: routePlan.totalDuration,
            }
          : undefined,
      }
    } catch (error) {
      console.error("❌ 生成行程失败:", error)
      throw error
    }
  }

  /**
   * 快速生成（跳过路线规划）
   */
  async generateTripQuick(input: TripGenerationInput): Promise<TripGenerationResult> {
    try {
      // 步骤 1: 完善用户描述
      const enhancedInput = await this.promptEnhancementService.enhanceInput(input)

      // 步骤 2: 匹配景点
      const preferences = this.promptEnhancementService.buildPreferencesForSearch(enhancedInput)
      const filters = this.promptEnhancementService.extractFilters(enhancedInput)

      const matchedAttractions = await this.vectorSearchService.searchByPreferences(
        preferences,
        {
          limit: 20,
          similarityThreshold: 0.7,
          ...filters,
        }
      )

      // 步骤 3: 生成行程（不进行路线规划）
      const selectedAttractions = matchedAttractions.slice(0, 15).map((attr) => ({
        name: attr.name,
        location: attr.location || "",
        type: attr.type || "",
        description: attr.description || "",
        rating: attr.rating || 0,
      }))

      let matchedHotels: Array<{ name: string; location: string | null; star: number; rating: number | null; priceDisplay: string | null; priceYuan: number | null }> = []
      try {
        matchedHotels = await searchHotelsByLocation(enhancedInput.destination, 8)
      } catch {
        // ignore
      }

      const trip = await generateTripItinerary(
        enhancedInput,
        selectedAttractions,
        undefined,
        matchedHotels.length > 0 ? matchedHotels : undefined
      )

      return {
        trip: {
          ...trip,
          id: Math.random().toString(36).substring(2, 15),
        },
        matchedAttractions: matchedAttractions.slice(0, 15).map((attr) => ({
          id: attr.attraction_id,
          name: attr.name,
          location: attr.location || "",
          type: attr.type || "",
          description: attr.description || "",
          rating: attr.rating || 0,
          similarity: attr.similarity,
        })),
      }
    } catch (error) {
      console.error("快速生成行程失败:", error)
      throw error
    }
  }
}
