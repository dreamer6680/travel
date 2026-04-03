import { NextRequest, NextResponse } from "next/server"
import { searchAttractions } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? ""
  const type = request.nextUrl.searchParams.get("type") ?? undefined

  return NextResponse.json(searchAttractions(query, type))
}
