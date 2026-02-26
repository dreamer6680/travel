// 后端接口地址端点配置
export const backendEndpoint = {
  // 认证相关
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    verify: "/auth/verify",
  },
  // 用户相关
  user: {
    profile: "/user/profile",
    preferences: "/user/preferences",
  },
  // 旅行计划相关
  trips: {
    base: "/trips",
    byId: (id: string) => `/trips/${id}`,
    user: "/trips/user",
  },
  // 推荐相关
  recommendations: {
    popular: "/recommendations/popular",
    hidden: "/recommendations/hidden",
    ai: "/recommendations/ai",
    search: "/recommendations/search",
  },
  // 数据相关
  data: {
    cities: "/data/cities",
    attractions: "/data/attractions",
    attractionById: (id: string) => `/data/attractions/${id}`,
  },
  // 博客相关
  blogs: {
    base: "/blogs",
    byId: (id: string) => `/blogs/${id}`,
  },
}

