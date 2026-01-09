import { fetchAPI } from "../api/fetch-api"
import { backendEndpoint } from "../api/backend-endpoint"

// 旅行计划服务
export class TripService {
  createTrip(tripData: any) {
    return fetchAPI(backendEndpoint.trips.base, {
      method: "POST",
      body: JSON.stringify(tripData),
    })
  }

  getTrip(tripId: string) {
    return fetchAPI(backendEndpoint.trips.byId(tripId))
  }

  getUserTrips(userId: string) {
    return fetchAPI(`${backendEndpoint.trips.user}?userId=${userId}`)
  }

  updateTrip(tripId: string, tripData: any) {
    return fetchAPI(backendEndpoint.trips.byId(tripId), {
      method: "PUT",
      body: JSON.stringify(tripData),
    })
  }

  confirmTrip(tripData: any) {
    return fetchAPI(backendEndpoint.trips.base, {
      method: "PUT",
      body: JSON.stringify(tripData),
    })
  }

  deleteTrip(tripId: string) {
    return fetchAPI(backendEndpoint.trips.byId(tripId), {
      method: "DELETE",
    })
  }
}

