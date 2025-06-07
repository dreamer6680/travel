import { NextResponse } from "next/server"
import clientPromise from "@/lib/db"

export async function GET(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("TravelBlogs")

    const blogs = await collection.find({ status: "published" }).toArray()
    return NextResponse.json(blogs)
  } catch (error) {
    console.error("获取游记失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const blogData = await request.json()
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("TravelBlogs")

    const newBlog = {
      ...blogData,
      id: Math.random().toString(36).substring(2, 15),
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await collection.insertOne(newBlog)
    return NextResponse.json(newBlog, { status: 201 })
  } catch (error) {
    console.error("创建游记失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
