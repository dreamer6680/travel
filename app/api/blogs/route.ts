import { NextResponse } from "next/server"
import { BlogService } from "@/server/controllers"

const blogService = new BlogService()

export async function GET(request: Request) {
  try {
    const blogs = await blogService.getPublishedBlogs()
    return NextResponse.json(blogs)
  } catch (error) {
    console.error("获取游记失败:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error("错误详情:", { errorMessage, errorStack })
    return NextResponse.json(
      { 
        error: "Internal Server Error",
        message: errorMessage,
        ...(process.env.NODE_ENV === "development" && { stack: errorStack })
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const blogData = await request.json()
    const newBlog = await blogService.createBlog(blogData)
    return NextResponse.json(newBlog, { status: 201 })
  } catch (error) {
    console.error("创建游记失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
