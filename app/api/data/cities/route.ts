import { NextResponse } from "next/server"
import { getCities } from "@/lib/mock-data"

export async function GET() {
  return NextResponse.json(getCities())
}
