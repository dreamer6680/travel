import { fetchAPI } from "../api/fetch-api"
import { backendEndpoint } from "../api/backend-endpoint"

// 数据服务
export class DataService {
  getCities() {
    return fetchAPI(backendEndpoint.data.cities)
  }

  getAttractions(cityId: string) {
    return fetchAPI(`${backendEndpoint.data.attractions}?cityId=${cityId}`)
  }

  getAttraction(attractionId: string) {
    return fetchAPI(backendEndpoint.data.attractionById(attractionId))
  }
}

