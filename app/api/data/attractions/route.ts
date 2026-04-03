import { NextRequest, NextResponse } from "next/server"
import { getAttractionsByCityId } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  const cityId = request.nextUrl.searchParams.get("cityId") ?? undefined
  return NextResponse.json(getAttractionsByCityId(cityId))
}
