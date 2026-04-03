import { NextResponse } from "next/server"
import { getPopularAttractions } from "@/lib/mock-data"

export async function GET() {
  return NextResponse.json(getPopularAttractions())
}
