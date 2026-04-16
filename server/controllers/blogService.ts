import clientPromise from "@/lib/db"

export class BlogService {
  /**
   * 获取所有博客（管理后台用）
   */
  async getAllBlogs() {
    try {
      const client = await clientPromise
      const db = client.db("trip")
      const collection = db.collection("TravelBlogs")
      const blogs = await collection.find({}).sort({ createdAt: -1 }).toArray()
      return blogs || []
    } catch (error) {
      console.error("BlogService.getAllBlogs 错误:", error)
      throw error
    }
  }

  /**
   * 切换博客发布状态
   */
  async togglePublish(id: string, status: "published" | "draft") {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("TravelBlogs")
    const result = await collection.updateOne(
      { id },
      { $set: { status, updatedAt: new Date().toISOString() } }
    )
    return result
  }

  /**
   * 获取所有已发布的博客
   */
  async getPublishedBlogs() {
    try {
      const client = await clientPromise
      const db = client.db("trip")
      const collection = db.collection("TravelBlogs")
      
      // 如果集合为空，返回空数组而不是错误
      const blogs = await collection.find({ status: "published" }).toArray()
      return blogs || []
    } catch (error) {
      console.error("BlogService.getPublishedBlogs 错误:", error)
      throw error
    }
  }

  /**
   * 根据 ID 获取博客
   */
  async getBlogById(id: string) {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("TravelBlogs")
    const blog = await collection.findOne({ id })
    return blog
  }

  /**
   * 创建博客
   */
  async createBlog(blogData: any) {
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
    return newBlog
  }

  /**
   * 更新博客
   */
  async updateBlog(id: string, updateData: any) {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("TravelBlogs")

    const result = await collection.updateOne(
      { id },
      {
        $set: {
          ...updateData,
          updatedAt: new Date().toISOString(),
        },
      },
    )

    return result
  }

  /**
   * 删除博客
   */
  async deleteBlog(id: string) {
    const client = await clientPromise
    const db = client.db("trip")
    const collection = db.collection("TravelBlogs")
    const result = await collection.deleteOne({ id })
    return result
  }
}

