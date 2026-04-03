import { NextResponse } from "next/server"
import { getUserProfile } from "@/lib/mock-data"

export async function POST(request: Request) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ message: "邮箱和密码不能为空" }, { status: 400 })
  }

  return NextResponse.json({
    token: "mock-token",
    user: getUserProfile(),
  })
}
