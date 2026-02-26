import { generateEmbedding, buildUserPreferenceText } from "./vector-service"
import { searchSimilarAttractions, AttractionVector } from "./knowledge-base-service"

export interface UserPreferences {
  destination?: string
  travelStyle?: string
  interests?: string | string[]
  budget?: number
  travelers?: number
}

export interface SimilarityMatchResult extends AttractionVector {
  similarity: number
  matchScore: number // 综合匹配分数（相似度 + 其他因素）
}

/**
 * 基于用户偏好匹配景点
 */
export async function matchAttractionsByPreferences(
  preferences: UserPreferences,
  options: {
    limit?: number
    similarityThreshold?: number
    locationFilter?: string
    typeFilter?: string
    minRating?: number
  } = {}
): Promise<SimilarityMatchResult[]> {
  const {
    limit = 20,
    similarityThreshold = 0.7,
    locationFilter,
    typeFilter,
    minRating = 3.5,
  } = options

  try {
    // 1. 构建用户偏好文本
    const preferenceText = buildUserPreferenceText(preferences)

    // 2. 生成用户偏好向量
    const preferenceEmbedding = await generateEmbedding(preferenceText)

    // 3. 向量相似度搜索
    const matches = await searchSimilarAttractions(
      preferenceEmbedding,
      limit * 2, // 获取更多结果，后续会重新排序
      similarityThreshold,
      {
        location: locationFilter || preferences.destination,
        type: typeFilter,
        minRating,
      }
    )

    // 4. 计算综合匹配分数
    const scoredMatches = matches.map((match) => {
      const similarity = match.similarity ?? 0
      let matchScore = similarity

      // 位置匹配加分
      if (preferences.destination && match.location) {
        if (match.location.includes(preferences.destination)) {
          matchScore += 0.1
        }
      }

      // 评分加分
      if (match.rating) {
        matchScore += (match.rating - 3.5) / 10 // 评分越高，加分越多
      }

      // 类型匹配（如果用户有明确兴趣）
      if (preferences.interests && match.type) {
        const interests = Array.isArray(preferences.interests)
          ? preferences.interests
          : [preferences.interests]
        if (interests.some((interest) => match.type?.includes(interest))) {
          matchScore += 0.05
        }
      }

      return {
        ...match,
        similarity,
        matchScore: Math.min(matchScore, 1.0), // 限制在 0-1 之间
      }
    })

    // 5. 按综合分数排序并返回前 N 个
    return scoredMatches
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)
  } catch (error) {
    console.error("匹配景点失败:", error)
    throw error
  }
}

/**
 * 多维度匹配策略
 * 结合向量相似度、位置、类型、评分等多个因素
 */
export async function multiDimensionalMatch(
  preferences: UserPreferences,
  options: {
    limit?: number
    weights?: {
      similarity?: number
      location?: number
      type?: number
      rating?: number
    }
  } = {}
): Promise<SimilarityMatchResult[]> {
  const {
    limit = 20,
    weights = {
      similarity: 0.6,
      location: 0.2,
      type: 0.1,
      rating: 0.1,
    },
  } = options

  // 确保权重有默认值
  const similarityWeight = weights.similarity ?? 0.6
  const locationWeight = weights.location ?? 0.2
  const typeWeight = weights.type ?? 0.1
  const ratingWeight = weights.rating ?? 0.1

  // 先进行向量匹配
  const vectorMatches = await matchAttractionsByPreferences(preferences, {
    limit: limit * 2,
    similarityThreshold: 0.6, // 降低阈值以获取更多候选
  })

  // 多维度评分
  const scored = vectorMatches.map((match) => {
    const similarity = match.similarity ?? 0
    let score = similarity * similarityWeight

    // 位置匹配
    if (preferences.destination && match.location) {
      const locationMatch = match.location.includes(preferences.destination) ? 1 : 0
      score += locationMatch * locationWeight
    }

    // 类型匹配
    if (preferences.interests && match.type) {
      const interests = Array.isArray(preferences.interests)
        ? preferences.interests
        : [preferences.interests]
      const typeMatch = interests.some((interest) =>
        match.type?.toLowerCase().includes(interest.toLowerCase())
      )
        ? 1
        : 0
      score += typeMatch * typeWeight
    }

    // 评分
    if (match.rating) {
      const ratingScore = (match.rating - 3.0) / 2.0 // 归一化到 0-1
      score += ratingScore * ratingWeight
    }

    return {
      ...match,
      matchScore: Math.min(score, 1.0),
    }
  })

  // 按综合分数排序
  return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit)
}
