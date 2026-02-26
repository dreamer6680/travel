import {
  matchAttractionsByPreferences,
  multiDimensionalMatch,
  UserPreferences,
  SimilarityMatchResult,
} from "@/lib/services/similarity-service"

export class VectorSearchService {
  /**
   * 基于用户偏好搜索景点
   */
  async searchByPreferences(
    preferences: UserPreferences,
    options: {
      limit?: number
      similarityThreshold?: number
      locationFilter?: string
      typeFilter?: string
      minRating?: number
      useMultiDimensional?: boolean
    } = {}
  ): Promise<SimilarityMatchResult[]> {
    try {
      if (options.useMultiDimensional) {
        return await multiDimensionalMatch(preferences, {
          limit: options.limit,
        })
      } else {
        return await matchAttractionsByPreferences(preferences, {
          limit: options.limit,
          similarityThreshold: options.similarityThreshold,
          locationFilter: options.locationFilter,
          typeFilter: options.typeFilter,
          minRating: options.minRating,
        })
      }
    } catch (error) {
      console.error("向量搜索失败:", error)
      throw error
    }
  }

  /**
   * 基于文本描述搜索景点
   */
  async searchByText(
    text: string,
    options: {
      limit?: number
      similarityThreshold?: number
    } = {}
  ): Promise<SimilarityMatchResult[]> {
    try {
      const { generateEmbedding } = await import("@/lib/services/vector-service")
      const { searchSimilarAttractions } = await import("@/lib/services/knowledge-base-service")

      const embedding = await generateEmbedding(text)

      const matches = await searchSimilarAttractions(
        embedding,
        options.limit || 20,
        options.similarityThreshold || 0.7
      )

      return matches.map((match) => ({
        ...match,
        similarity: match.similarity ?? 0,
        matchScore: match.similarity ?? 0,
      }))
    } catch (error) {
      console.error("文本搜索失败:", error)
      throw error
    }
  }

  /**
   * 混合搜索：结合向量搜索和关键词过滤
   */
  async hybridSearch(
    query: {
      text?: string
      preferences?: UserPreferences
    },
    options: {
      limit?: number
      keywords?: string[]
    } = {}
  ): Promise<SimilarityMatchResult[]> {
    try {
      let results: SimilarityMatchResult[] = []

      // 如果有文本查询，先进行文本搜索
      if (query.text) {
        const textResults = await this.searchByText(query.text, {
          limit: options.limit,
        })
        results = textResults
      }

      // 如果有偏好，进行偏好匹配
      if (query.preferences) {
        const preferenceResults = await this.searchByPreferences(
          query.preferences,
          {
            limit: options.limit,
          }
        )

        // 合并结果，去重，按分数排序
        const combined = [...results, ...preferenceResults]
        const unique = Array.from(
          new Map(combined.map((item) => [item.attraction_id, item])).values()
        )
        results = unique.sort((a, b) => b.matchScore - a.matchScore)
      }

      // 关键词过滤（如果提供）
      if (options.keywords && options.keywords.length > 0) {
        results = results.filter((result) => {
          const searchText = `${result.name} ${result.description} ${result.type}`.toLowerCase()
          return options.keywords!.some((keyword) =>
            searchText.includes(keyword.toLowerCase())
          )
        })
      }

      return results.slice(0, options.limit || 20)
    } catch (error) {
      console.error("混合搜索失败:", error)
      throw error
    }
  }
}
