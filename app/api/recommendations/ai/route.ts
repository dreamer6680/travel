import { NextResponse } from "next/server"
import { proxyJsonToPythonAgent } from "@/server/python-agent-client"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const destination = searchParams.get("destination") || "热门城市"
    const results = await proxyJsonToPythonAgent(
      `/v1/recommendations/ai?destination=${encodeURIComponent(destination)}`
    )
    return NextResponse.json(results)
  } catch (error) {
    console.error("❌ Failed to fetch recommendations:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
