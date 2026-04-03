import type { Attraction, TripRecord, UserProfile } from "@/lib/mock-data"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? ""

interface AuthResponse {
  token: string
  user: UserProfile
}

interface ApiMessage {
  message: string
}

interface City {
  id: string
  name: string
  country: string
}

function buildAPIUrl(endpoint: string) {
  const normalizedEndpoint = endpoint.startsWith("/api/") ? endpoint : `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  return API_BASE_URL ? `${API_BASE_URL}${normalizedEndpoint}` : normalizedEndpoint
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null)
  }

  return response.text().catch(() => "")
}

async function fetchAPI<T = unknown>(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(buildAPIUrl(endpoint), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  })

  const payload = await parseResponseBody(response)

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null
        ? String((payload as { message?: string; error?: string }).message ?? (payload as { error?: string }).error ?? "请求失败")
        : typeof payload === "string" && payload
          ? payload
          : "请求失败"

    throw new Error(message)
  }

  return payload as T
}

export const userAPI = {
  login: (email: string, password: string) => {
    return fetchAPI<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  },

  register: (userData: Record<string, unknown>) => {
    return fetchAPI<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    })
  },

  getProfile: () => {
    return fetchAPI<UserProfile>("/user/profile")
  },

  updateProfile: (profileData: Record<string, unknown>) => {
    return fetchAPI<UserProfile>("/user/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    })
  },

  updatePreferences: (preferences: Record<string, unknown>) => {
    return fetchAPI<UserProfile>("/user/profile", {
      method: "PUT",
      body: JSON.stringify(preferences),
    })
  },
}

export const tripAPI = {
  createTrip: (tripData: Record<string, unknown>) => {
    return fetchAPI<TripRecord>("/trips", {
      method: "POST",
      body: JSON.stringify(tripData),
    })
  },

  getTrip: (tripId: string) => {
    return fetchAPI<TripRecord>(`/trips/${tripId}`)
  },

  getUserTrips: () => {
    return fetchAPI<TripRecord[]>("/trips/user")
  },

  updateTrip: (tripId: string, tripData: Record<string, unknown>) => {
    return fetchAPI<TripRecord>(`/trips/${tripId}`, {
      method: "PUT",
      body: JSON.stringify(tripData),
    })
  },

  deleteTrip: (tripId: string) => {
    return fetchAPI<ApiMessage>(`/trips/${tripId}`, {
      method: "DELETE",
    })
  },
}

export const recommendationAPI = {
  getPopularAttractions: (params: Record<string, string> = {}) => {
    const queryParams = new URLSearchParams(params).toString()
    return fetchAPI<Attraction[]>(`/recommendations/popular${queryParams ? `?${queryParams}` : ""}`)
  },

  getHiddenGems: (params: Record<string, string> = {}) => {
    const queryParams = new URLSearchParams(params).toString()
    return fetchAPI<Attraction[]>(`/recommendations/hidden${queryParams ? `?${queryParams}` : ""}`)
  },

  getAIRecommendations: (params: Record<string, string> = {}) => {
    const queryParams = new URLSearchParams(params).toString()
    return fetchAPI<Attraction[]>(`/recommendations/ai${queryParams ? `?${queryParams}` : ""}`)
  },

  searchAttractions: (query: string, filters: Record<string, string> = {}) => {
    const queryParams = new URLSearchParams({
      q: query,
      ...filters,
    }).toString()
    return fetchAPI<Attraction[]>(`/recommendations/search${queryParams ? `?${queryParams}` : ""}`)
  },
}

export const dataAPI = {
  getCities: () => {
    return fetchAPI<City[]>("/data/cities")
  },

  getAttractions: (cityId?: string) => {
    return fetchAPI<Attraction[]>(
      cityId ? `/data/attractions?cityId=${encodeURIComponent(cityId)}` : "/data/attractions",
    )
  },

  getAttraction: (attractionId: string) => {
    return fetchAPI<Attraction>(`/data/attractions/${attractionId}`)
  },
}
