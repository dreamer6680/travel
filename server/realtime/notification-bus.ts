import { EventEmitter } from "events"
import Redis from "ioredis"
import type { Notification } from "@/server/controllers/notificationService"

const CHANNEL = "trip:notifications"
const emitter = new EventEmitter()
const LOG_PREFIX = "[notification-bus]"

type NotificationEvent = {
  userId: string
  notification: Notification
}

let publisher: Redis | null = null
let subscriber: Redis | null = null
let subscribed = false

function getRedisUrl() {
  return process.env.REDIS_URL || ""
}

function maskedRedisUrl() {
  const url = getRedisUrl()
  if (!url) return "(empty)"
  try {
    const u = new URL(url)
    if (u.password) u.password = "***"
    return u.toString()
  } catch {
    return "invalid REDIS_URL"
  }
}

function attachRedisLogs(client: Redis, role: "publisher" | "subscriber") {
  client.on("connect", () => {
    console.info(`${LOG_PREFIX} ${role} connected: ${maskedRedisUrl()}`)
  })
  client.on("ready", () => {
    console.info(`${LOG_PREFIX} ${role} ready`)
  })
  client.on("reconnecting", (delay: number) => {
    console.warn(`${LOG_PREFIX} ${role} reconnecting in ${delay}ms`)
  })
  client.on("end", () => {
    console.error(`${LOG_PREFIX} ${role} disconnected`)
  })
  client.on("error", (err) => {
    console.error(`${LOG_PREFIX} ${role} error:`, err.message)
  })
}

function initPublisher() {
  if (publisher || !getRedisUrl()) return
  publisher = new Redis(getRedisUrl(), { maxRetriesPerRequest: 3 })
  attachRedisLogs(publisher, "publisher")
}

function initSubscriber() {
  if (subscriber || !getRedisUrl()) return
  subscriber = new Redis(getRedisUrl(), { maxRetriesPerRequest: 3 })
  attachRedisLogs(subscriber, "subscriber")
  subscriber.on("message", (channel, payload) => {
    if (channel !== CHANNEL) return
    try {
      const event = JSON.parse(payload) as NotificationEvent
      emitter.emit("notification", event)
    } catch {
      // 忽略坏消息
    }
  })
}

async function ensureSubscribed() {
  initSubscriber()
  if (!subscriber || subscribed) return
  await subscriber.subscribe(CHANNEL)
  subscribed = true
  console.info(`${LOG_PREFIX} subscriber subscribed channel=${CHANNEL}`)
}

export async function publishNotification(event: NotificationEvent) {
  // 单实例下也可实时广播
  emitter.emit("notification", event)

  initPublisher()
  if (!publisher) return
  try {
    await publisher.publish(CHANNEL, JSON.stringify(event))
  } catch {
    console.error(`${LOG_PREFIX} publish failed, fallback to local emitter only`)
  }
}

export async function subscribeNotifications(
  listener: (event: NotificationEvent) => void
) {
  await ensureSubscribed()
  emitter.on("notification", listener)
  return () => {
    emitter.off("notification", listener)
  }
}

