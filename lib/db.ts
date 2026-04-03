import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

export function isMongoConfigured() {
  return Boolean(uri)
}

export function getMongoClient() {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured")
  }

  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = new MongoClient(uri).connect()
  }

  return globalThis._mongoClientPromise
}
