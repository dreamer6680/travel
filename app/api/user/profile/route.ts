import { NextResponse } from "next/server"
import { getUserProfile, updateUserProfile } from "@/lib/mock-data"

export async function GET() {
  return NextResponse.json(getUserProfile())
}

export async function PUT(request: Request) {
  try {
    const userData = await request.json()
    const updatedProfile = updateUserProfile(userData)

    return NextResponse.json(updatedProfile)
  } catch (error) {
    console.error("更新用户信息失败:", error)
    return NextResponse.json({ message: "更新用户信息失败" }, { status: 500 })
  }
}
