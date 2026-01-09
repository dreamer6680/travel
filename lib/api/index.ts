// 导出后端端点配置
export { backendEndpoint } from "./backend-endpoint"

// 导出通用请求函数
export { fetchAPI } from "./fetch-api"

// 导入各个服务类
import { UserService } from "../api-client/user-service"
import { TripService } from "../api-client/trip-service"
import { RecommendationService } from "../api-client/recommendation-service"
import { DataService } from "../api-client/data-service"
import { BlogService } from "../api-client/blog-service"

// 导出各个服务类
export { UserService } from "../api-client/user-service"
export { TripService } from "../api-client/trip-service"
export { RecommendationService } from "../api-client/recommendation-service"
export { DataService } from "../api-client/data-service"
export { BlogService } from "../api-client/blog-service"

// 导出服务实例（保持向后兼容）
export const userAPI = new UserService()
export const tripAPI = new TripService()
export const recommendationAPI = new RecommendationService()
export const dataAPI = new DataService()
export const blogAPI = new BlogService()

