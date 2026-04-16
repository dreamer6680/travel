import { fetchAPI, getToken } from "../api/fetch-api"
import { backendEndpoint } from "../api/backend-endpoint"

export class BlogService {
  getBlogs() {
    return fetchAPI(backendEndpoint.blogs.base)
  }

  /** 管理员获取全部游记（含草稿） */
  getAllBlogs() {
    return fetchAPI(backendEndpoint.blogs.admin)
  }

  getBlog(blogId: string) {
    return fetchAPI(backendEndpoint.blogs.byId(blogId))
  }

  createBlog(blogData: any) {
    return fetchAPI(backendEndpoint.blogs.base, {
      method: "POST",
      body: JSON.stringify(blogData),
    })
  }

  updateBlog(blogId: string, blogData: any) {
    return fetchAPI(backendEndpoint.blogs.byId(blogId), {
      method: "PUT",
      body: JSON.stringify(blogData),
    })
  }

  deleteBlog(blogId: string) {
    return fetchAPI(backendEndpoint.blogs.byId(blogId), {
      method: "DELETE",
    })
  }

  /** 获取当前登录用户的全部游记（所有状态） */
  getMyBlogs() {
    return fetchAPI(backendEndpoint.blogs.user)
  }

  /** 切换游记发布状态（admin 使用） */
  togglePublish(blogId: string, status: "published" | "pending" | "draft") {
    return fetchAPI(backendEndpoint.blogs.publish(blogId), {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })
  }

  /** 发表评论 */
  addComment(blogId: string, content: string) {
    return fetchAPI(backendEndpoint.blogs.comments(blogId), {
      method: "POST",
      body: JSON.stringify({ content }),
    })
  }

  /** 上传头像，返回 { url } */
  async uploadAvatar(file: File): Promise<{ url: string }> {
    const token = getToken()
    const formData = new FormData()
    formData.append("file", file)

    // 使用相对路径，避免跨端口 CORS 预检
    const res = await fetch(`/api${backendEndpoint.uploads.avatar}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || "头像上传失败")
    }
    return res.json()
  }
}
