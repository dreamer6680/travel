// API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"

// 通用请求函数
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || "请求失败")
  }

  return response.json()
}

// 用户相关API
export const userAPI = {
  login: (email: string, password: string) => {
    return fetchAPI("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  },

  register: (userData: any) => {
    return fetchAPI("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    })
  },

  getProfile: () => {
    return fetchAPI("/user/profile")
  },

  updateProfile: (profileData: any) => {
    return fetchAPI("/user/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    })
  },

  updatePreferences: (preferences: any) => {
    return fetchAPI("/user/preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
    })
  },
}

// 旅行计划相关API
export const tripAPI = {
  createTrip: (tripData: any) => {
    return fetchAPI("/trips", {
      method: "POST",
      body: JSON.stringify(tripData),
    })
  },

  getTrip: (tripId: string) => {
    return fetchAPI(`/trips/${tripId}`)
  },

  getUserTrips: (userId: string) => {
    return fetchAPI(`/trips/user?userId=${userId}`)
  },

  updateTrip: (tripId: string, tripData: any) => {
    return fetchAPI(`/trips/${tripId}`, {
      method: "PUT",
      body: JSON.stringify(tripData),
    })
  },

  deleteTrip: (tripId: string) => {
    return fetchAPI(`/trips/${tripId}`, {
      method: "DELETE",
    })
  },
}

// 推荐相关API
export const recommendationAPI = {
  getPopularAttractions: (params: any = {}) => {
    const queryParams = new URLSearchParams(params).toString()
    return fetchAPI(`/recommendations/popular?${queryParams}`)
  },

  getHiddenGems: (params: any = {}) => {
    const queryParams = new URLSearchParams(params).toString()
    return fetchAPI(`/recommendations/hidden?${queryParams}`)
  },

  getAIRecommendations: (params: any = {}) => {
    const queryParams = new URLSearchParams(params).toString()
    return fetchAPI(`/recommendations/ai?${queryParams}`)
  },

  searchAttractions: (query: string, filters: any = {}) => {
    const queryParams = new URLSearchParams({
      q: query,
      ...filters,
    }).toString()
    return fetchAPI(`/recommendations/search?${queryParams}`)
  },
}

// 城市和景点数据API
export const dataAPI = {
  getCities: () => {
    return fetchAPI("/data/cities")
  },

  getAttractions: (cityId: string) => {
    return fetchAPI(`/data/attractions?cityId=${cityId}`)
  },

  getAttraction: (attractionId: string) => {
    return fetchAPI(`/data/attractions/${attractionId}`)
  },
}

export const blogAPI = {
  getBlogs: () => {
    return fetchAPI(`/blogs`)
  },

  getBlog: (blogId: string) => {
    return fetchAPI(`/blogs/${blogId}`)
  },

  createBlog: (blogData: any) => {
    return fetchAPI(`/blogs`, {
      method: "POST",
      body: JSON.stringify(blogData),
    })
  },
}
