import { fetchAPI } from "../api/fetch-api"
import { backendEndpoint } from "../api/backend-endpoint"

// 博客服务
export class BlogService {
  getBlogs() {
    return fetchAPI(backendEndpoint.blogs.base)
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
}

