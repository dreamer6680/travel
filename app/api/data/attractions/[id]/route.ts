import { NextResponse } from "next/server"
import { getAttractionById } from "@/lib/mock-data"

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params
  const attraction = getAttractionById(params.id)

  if (!attraction) {
    return NextResponse.json({ message: "未找到景点" }, { status: 404 })
  }

  return NextResponse.json(attraction)
}
