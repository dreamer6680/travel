import clientPromise from "@/lib/db"
import { randomUUID } from "crypto"

export interface ChatMsg {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
}

export interface ChatSession {
  id: string
  userId: string
  title: string
  messages: ChatMsg[]
  createdAt: string
  updatedAt: string
}

class ChatService {
  private col() {
    return clientPromise.then((c) => c.db("trip").collection<ChatSession>("ChatSessions"))
  }

  /** 列表不携带 messages，减少传输 */
  async getSessionsByUserId(userId: string) {
    const col = await this.col()
    return col
      .find({ userId })
      .sort({ updatedAt: -1 })
      .project({ messages: 0 })
      .limit(60)
      .toArray()
  }

  async getSessionById(sessionId: string, userId: string) {
    const col = await this.col()
    return col.findOne({ id: sessionId, userId })
  }

  async createSession(userId: string, firstUserMessage: string): Promise<string> {
    const col = await this.col()
    const id = randomUUID()
    const title =
      firstUserMessage.length > 40 ? firstUserMessage.slice(0, 40) + "…" : firstUserMessage
    const now = new Date().toISOString()
    await col.insertOne({
      id, userId, title,
      messages: [],
      createdAt: now,
      updatedAt: now,
    })
    return id
  }

  async appendMessages(
    sessionId: string,
    userId: string,
    msgs: Pick<ChatMsg, "role" | "content">[],
  ) {
    const col = await this.col()
    const now = new Date().toISOString()
    const stamped: ChatMsg[] = msgs.map((m) => ({ ...m, timestamp: now }))
    return col.updateOne(
      { id: sessionId, userId },
      { $push: { messages: { $each: stamped } } as any, $set: { updatedAt: now } },
    )
  }

  async deleteSession(sessionId: string, userId: string) {
    const col = await this.col()
    return col.deleteOne({ id: sessionId, userId })
  }
}

export const chatService = new ChatService()
