import { NextResponse } from "next/server"
import { authenticateRequest } from "@/server/middleware/auth.middleware"
import clientPromise from "@/lib/db"

/** GET /api/trips/[id]/favorite — 查询当前用户是否收藏了该行程 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const authResult = await authenticateRequest(request as any)
  if (!authResult.authenticated) return authResult.response!

  const userId = authResult.user!.id
  const tripId = params.id

  const client = await clientPromise
  const db = client.db("trip")
  const users = db.collection("Users")

  const user = await users.findOne({ id: Number(userId) })
  const favoriteTrips: string[] = user?.favoriteTrips || []

  return NextResponse.json({ favorited: favoriteTrips.includes(tripId) })
}

/** POST /api/trips/[id]/favorite — 切换收藏状态，返回最新状态 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authResult = await authenticateRequest(request as any)
  if (!authResult.authenticated) return authResult.response!

  const userId = authResult.user!.id
  const tripId = params.id

  const client = await clientPromise
  const db = client.db("trip")
  const users = db.collection("Users")

  const user = await users.findOne({ id: Number(userId) })
  const currentFavorites: string[] = user?.favoriteTrips || []

  let favorited: boolean
  if (currentFavorites.includes(tripId)) {
    await users.updateOne(
      { id: Number(userId) },
      { $pull: { favoriteTrips: tripId } } as any
    )
    favorited = false
  } else {
    await users.updateOne(
      { id: Number(userId) },
      { $addToSet: { favoriteTrips: tripId } } as any
    )
    favorited = true
  }

  return NextResponse.json({ favorited })
}
