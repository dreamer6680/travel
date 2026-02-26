import { enhanceUserInput, EnhancedUserInput } from "./llm-service"
import { buildUserPreferenceText } from "./vector-service"

/**
 * 用户输入增强服务
 * 将原始用户输入转换为结构化的、可用于向量搜索的格式
 */
export class PromptEnhancementService {
  /**
   * 完善用户输入
   */
  async enhanceInput(rawInput: {
    destination?: string
    startDate?: string
    endDate?: string
    travelers?: number
    budget?: number
    travelStyle?: string
    interests?: string
  }): Promise<EnhancedUserInput> {
    return await enhanceUserInput(rawInput)
  }

  /**
   * 从增强后的输入生成向量搜索查询文本
   */
  generateSearchQuery(enhancedInput: EnhancedUserInput): string {
    return buildUserPreferenceText({
      destination: enhancedInput.destination,
      travelStyle: enhancedInput.travelStyle,
      interests: enhancedInput.interests,
      budget: enhancedInput.budget,
      travelers: enhancedInput.travelers,
    })
  }

  /**
   * 提取结构化需求用于过滤
   */
  extractFilters(enhancedInput: EnhancedUserInput): {
    location?: string
    type?: string
    minRating?: number
  } {
    const filters: {
      location?: string
      type?: string
      minRating?: number
    } = {}

    if (enhancedInput.destination) {
      filters.location = enhancedInput.destination
    }

    if (
      enhancedInput.structuredRequirements?.preferredTypes &&
      enhancedInput.structuredRequirements.preferredTypes.length > 0
    ) {
      // 使用第一个偏好类型作为过滤条件
      filters.type = enhancedInput.structuredRequirements.preferredTypes[0]
    }

    // 根据预算设置最低评分要求
    if (enhancedInput.budget) {
      if (enhancedInput.budget > 20000) {
        filters.minRating = 4.5 // 高预算，要求高评分
      } else if (enhancedInput.budget > 10000) {
        filters.minRating = 4.0 // 中等预算
      } else {
        filters.minRating = 3.5 // 低预算
      }
    }

    return filters
  }

  /**
   * 生成用于向量搜索的用户偏好对象
   */
  buildPreferencesForSearch(enhancedInput: EnhancedUserInput) {
    return {
      destination: enhancedInput.destination,
      travelStyle: enhancedInput.travelStyle,
      interests: enhancedInput.interests,
      budget: enhancedInput.budget,
      travelers: enhancedInput.travelers,
    }
  }
}
