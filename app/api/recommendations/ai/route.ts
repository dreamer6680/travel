import { NextResponse } from "next/server"
import { proxyJsonToPythonAgent } from "@/server/python-agent-client"
import { UserService } from "@/server/controllers"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

const userService = new UserService()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const destination = searchParams.get("destination")?.trim() || ""
    const authResult = await authenticateRequest(request as any)
    const userId = authResult.authenticated
      ? String(authResult.user?.id || authResult.payload?.userId || "")
      : ""
    const profile = userId ? await userService.getUserProfile(userId).catch(() => null) : null

    const results = await proxyJsonToPythonAgent("/v1/recommendations/ai", {
      method: "POST",
      body: JSON.stringify({
        destination: destination || undefined,
        userId: userId || undefined,
        preferences: profile?.preferences,
      }),
    })
    return NextResponse.json(results)
  } catch (error) {
    console.error("❌ Failed to fetch recommendations:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
