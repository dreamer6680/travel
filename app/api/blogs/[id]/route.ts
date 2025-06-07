import { NextResponse } from "next/server"
import clientPromise from "@/lib/db"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("TravelBlogs")

    const blog = await collection.findOne({ id: params.id })

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 })
    }

    return NextResponse.json(blog)
  } catch (error) {
    console.error("获取游记失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const updateData = await request.json()
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("TravelBlogs")

    const result = await collection.updateOne(
      { id: params.id },
      {
        $set: {
          ...updateData,
          updatedAt: new Date().toISOString(),
        },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Blog updated successfully" })
  } catch (error) {
    console.error("更新游记失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("TravelBlogs")

    const result = await collection.deleteOne({ id: params.id })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Blog deleted successfully" })
  } catch (error) {
    console.error("删除游记失败:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
