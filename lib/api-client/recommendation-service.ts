import { fetchAPI } from "../api/fetch-api"
import { backendEndpoint } from "../api/backend-endpoint"

// 推荐服务
export class RecommendationService {
  getPopularAttractions(params: any = {}) {
    const queryParams = new URLSearchParams(params).toString()
    return fetchAPI(`${backendEndpoint.recommendations.popular}?${queryParams}`)
  }

  getHiddenGems(params: any = {}) {
    const queryParams = new URLSearchParams(params).toString()
    return fetchAPI(`${backendEndpoint.recommendations.hidden}?${queryParams}`)
  }

  getAIRecommendations(params: any = {}) {
    const queryParams = new URLSearchParams(params).toString()
    return fetchAPI(`${backendEndpoint.recommendations.ai}?${queryParams}`)
  }

  searchAttractions(query: string, filters: any = {}) {
    const queryParams = new URLSearchParams({
      q: query,
      ...filters,
    }).toString()
    return fetchAPI(`${backendEndpoint.recommendations.search}?${queryParams}`)
  }
}

