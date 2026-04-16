import clientPromise from "@/lib/db"
import { randomUUID } from "crypto"
import { publishNotification } from "@/server/realtime/notification-bus"

export type NotificationType =
  | "comment_reply"
  | "blog_approved"
  | "blog_rejected"
  | "trip_complete"

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string
  read: boolean
  createdAt: string
}

export class NotificationService {
  private col() {
    return clientPromise.then((c) => c.db("trip").collection<Notification>("Notifications"))
  }

  async create(data: Omit<Notification, "id" | "read" | "createdAt">) {
    const col = await this.col()
    const doc: Notification = {
      ...data,
      id: randomUUID(),
      read: false,
      createdAt: new Date().toISOString(),
    }
    await col.insertOne(doc)
    await publishNotification({ userId: doc.userId, notification: doc })
    return doc
  }

  async getByUserId(userId: string, limit = 30): Promise<Notification[]> {
    const col = await this.col()
    return col
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  }

  async getUnreadCount(userId: string): Promise<number> {
    const col = await this.col()
    return col.countDocuments({ userId, read: false })
  }

  async markAsRead(id: string, userId: string) {
    const col = await this.col()
    return col.updateOne({ id, userId }, { $set: { read: true } })
  }

  async markAllAsRead(userId: string) {
    const col = await this.col()
    return col.updateMany({ userId, read: false }, { $set: { read: true } })
  }
}
