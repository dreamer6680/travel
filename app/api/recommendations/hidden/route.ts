import { NextResponse } from "next/server"
import { getHiddenGemAttractions } from "@/lib/mock-data"

export async function GET() {
  return NextResponse.json(getHiddenGemAttractions())
}
