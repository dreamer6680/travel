import { NextResponse } from "next/server"
import { UserService } from "@/server/controllers"

const userService = new UserService()

export async function GET(request: Request) {
  try {
    const userProfile = await userService.getUserProfile()
    return NextResponse.json(userProfile)
  } catch (error) {
    console.error("获取用户信息失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const userData = await request.json()
    const result = await userService.updateUserProfile(userData)
    return NextResponse.json(result)
  } catch (error) {
    console.error("更新用户信息失败:", error)
    return NextResponse.json({ message: "更新用户信息失败" }, { status: 500 })
  }
}
