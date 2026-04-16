import { fetchAPI } from "../api/fetch-api"
import { backendEndpoint } from "../api/backend-endpoint"
import type { Notification } from "@/server/controllers/notificationService"

export type { Notification }

export class NotificationService {
  async getNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
    return fetchAPI(backendEndpoint.notifications.base)
  }

  async markAsRead(id: string): Promise<void> {
    return fetchAPI(backendEndpoint.notifications.readOne(id), { method: "PATCH" })
  }

  async markAllAsRead(): Promise<void> {
    return fetchAPI(backendEndpoint.notifications.readAll, { method: "PATCH" })
  }
}
