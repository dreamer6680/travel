import { fetchAPI } from "../api/fetch-api"
import { backendEndpoint } from "../api/backend-endpoint"

// 用户服务
export class UserService {
  login(email: string, password: string) {
    return fetchAPI(backendEndpoint.auth.login, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  }

  register(userData: any) {
    return fetchAPI(backendEndpoint.auth.register, {
      method: "POST",
      body: JSON.stringify(userData),
    })
  }

  getProfile() {
    return fetchAPI(backendEndpoint.user.profile)
  }

  updateProfile(profileData: any) {
    return fetchAPI(backendEndpoint.user.profile, {
      method: "PUT",
      body: JSON.stringify(profileData),
    })
  }

  updatePreferences(preferences: any) {
    return fetchAPI(backendEndpoint.user.preferences, {
      method: "PUT",
      body: JSON.stringify(preferences),
    })
  }
}

