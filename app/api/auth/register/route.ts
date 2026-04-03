import { NextResponse } from "next/server"
import { getUserProfile } from "@/lib/mock-data"

export async function POST(request: Request) {
  const payload = await request.json()

  if (!payload.email || !payload.name || !payload.password) {
    return NextResponse.json({ message: "姓名、邮箱和密码不能为空" }, { status: 400 })
  }

  return NextResponse.json(
    {
      token: "mock-token",
      user: {
        ...getUserProfile(),
        name: payload.name,
        email: payload.email,
      },
    },
    { status: 201 },
  )
}
