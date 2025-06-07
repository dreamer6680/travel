"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Heart, MessageCircle, Share2, Search, Filter, Calendar, MapPin, Eye, Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"

interface Blog {
  id: number
  userId: string
  title: string
  content: string
  images: string[]
  destination: string
  tags: string[]
  likes: number
  likedBy: string[]
  comments: {
    id: string
    userId: string
    userName: string
    userAvatar: string
    content: string
    createdAt: string
  }[]
  author: {
    name: string
    avatar: string
  }
  status: "draft" | "published"
  createdAt: string
  updatedAt: string
}

export default function BlogsPage() {
  const { toast } = useToast()
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTag, setSelectedTag] = useState("all")

  useEffect(() => {
    fetchBlogs()
  }, [])

  const fetchBlogs = async () => {
    try {
      setIsLoading(true)
      // 模拟API调用
      const mockBlogs: Blog[] = [
        {
          id: 1,
          userId: "user1",
          title: "东京5日游：传统与现代的完美融合",
          content: `这次东京之行真的让我印象深刻！从传统的浅草寺到现代的晴空塔，东京完美地融合了传统与现代。

早上我们首先来到了浅草寺，这里是东京最古老的寺庙。仲见世通的小吃和纪念品让人目不暇接，特别推荐人形烧和雷门饼干。

下午登上了晴空塔，634米的高度让整个东京尽收眼底。夜景更是美得令人窒息！

东京的美食真的是太棒了！从浅草的传统寿司到银座的高级料理，每一餐都是享受。特别推荐筑地市场的海鲜丼，新鲜到爆炸！`,
          images: [
            "/placeholder.svg?height=400&width=600",
            "/placeholder.svg?height=400&width=600",
            "/placeholder.svg?height=400&width=600",
          ],
          destination: "东京, 日本",
          tags: ["东京", "美食", "购物", "传统文化", "现代都市"],
          likes: 128,
          likedBy: ["user2", "user3", "user4"],
          comments: [
            {
              id: "comment1",
              userId: "user2",
              userName: "李四",
              userAvatar: "/placeholder.svg?height=40&width=40",
              content: "写得太好了！我也想去东京了，请问有什么推荐的住宿吗？",
              createdAt: "2025-01-05T10:30:00Z",
            },
            {
              id: "comment2",
              userId: "user3",
              userName: "王五",
              userAvatar: "/placeholder.svg?height=40&width=40",
              content: "照片拍得真美！晴空塔的夜景确实很震撼",
              createdAt: "2025-01-05T14:20:00Z",
            },
          ],
          author: {
            name: "张三",
            avatar: "/placeholder.svg?height=40&width=40",
          },
          status: "published",
          createdAt: "2025-01-05T08:00:00Z",
          updatedAt: "2025-01-05T08:00:00Z",
        },
        {
          id: 2,
          userId: "user2",
          title: "巴黎浪漫之旅：艺术与美食的盛宴",
          content: `巴黎，这座浪漫之都真的没有让我失望！从卢浮宫的艺术珍品到塞纳河畔的日落，每一刻都充满了诗意。

第一站当然是埃菲尔铁塔，虽然游客很多，但当夜幕降临，铁塔亮起金色的灯光时，那种震撼是无法用言语形容的。

卢浮宫更是艺术爱好者的天堂，蒙娜丽莎的微笑、维纳斯的优雅，每一件作品都让人流连忘返。

巴黎的咖啡文化也让我印象深刻，在香榭丽舍大街的咖啡馆里坐下，点一杯咖啡，看着来往的行人，感受这座城市的节奏。`,
          images: ["/placeholder.svg?height=400&width=600", "/placeholder.svg?height=400&width=600"],
          destination: "巴黎, 法国",
          tags: ["巴黎", "艺术", "咖啡", "浪漫", "博物馆"],
          likes: 89,
          likedBy: ["user1", "user3"],
          comments: [
            {
              id: "comment3",
              userId: "user1",
              userName: "张三",
              userAvatar: "/placeholder.svg?height=40&width=40",
              content: "巴黎真的很美！我下次也想去卢浮宫看看",
              createdAt: "2025-01-06T09:15:00Z",
            },
          ],
          author: {
            name: "李四",
            avatar: "/placeholder.svg?height=40&width=40",
          },
          status: "published",
          createdAt: "2025-01-06T07:30:00Z",
          updatedAt: "2025-01-06T07:30:00Z",
        },
        {
          id: 3,
          userId: "user3",
          title: "京都古韵：寻找日本的传统之美",
          content: `京都是我心中最美的日本城市，这里保存着最纯正的日本传统文化。

清水寺的木质建筑让人叹为观止，从舞台上俯瞰京都市区，特别是樱花季节，满城的粉色让人如痴如醉。

金阁寺的金色倒影在池水中摇曳，仿佛一幅活动的画卷。伏见稻荷大社的千本鸟居更是壮观，红色的鸟居延绵不绝，仿佛通往神秘的世界。

在岚山的竹林中漫步，阳光透过竹叶洒下斑驳的光影，那种宁静致远的感觉让人心灵得到净化。`,
          images: [
            "/placeholder.svg?height=400&width=600",
            "/placeholder.svg?height=400&width=600",
            "/placeholder.svg?height=400&width=600",
            "/placeholder.svg?height=400&width=600",
          ],
          destination: "京都, 日本",
          tags: ["京都", "传统文化", "寺庙", "樱花", "竹林"],
          likes: 156,
          likedBy: ["user1", "user2", "user4", "user5"],
          comments: [
            {
              id: "comment4",
              userId: "user2",
              userName: "李四",
              userAvatar: "/placeholder.svg?height=40&width=40",
              content: "京都真的太美了！什么时候去最好呢？",
              createdAt: "2025-01-07T11:20:00Z",
            },
            {
              id: "comment5",
              userId: "user1",
              userName: "张三",
              userAvatar: "/placeholder.svg?height=40&width=40",
              content: "春天樱花季和秋天红叶季都很美，各有特色",
              createdAt: "2025-01-07T12:45:00Z",
            },
          ],
          author: {
            name: "王五",
            avatar: "/placeholder.svg?height=40&width=40",
          },
          status: "published",
          createdAt: "2025-01-07T06:00:00Z",
          updatedAt: "2025-01-07T06:00:00Z",
        },
      ]

      setBlogs(mockBlogs)
    } catch (error) {
      toast({
        title: "加载失败",
        description: "无法加载游记，请稍后再试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLike = async (blogId: number) => {
    try {
      setBlogs(
        blogs.map((blog) =>
          blog.id === blogId
            ? {
                ...blog,
                likes: blog.likedBy.includes("currentUser") ? blog.likes - 1 : blog.likes + 1,
                likedBy: blog.likedBy.includes("currentUser")
                  ? blog.likedBy.filter((id) => id !== "currentUser")
                  : [...blog.likedBy, "currentUser"],
              }
            : blog,
        ),
      )
    } catch (error) {
      toast({
        title: "操作失败",
        description: "请稍后再试",
        variant: "destructive",
      })
    }
  }

  // 获取所有标签
  const allTags = Array.from(new Set(blogs.flatMap((blog) => blog.tags)))

  // 筛选游记
  const filteredBlogs = blogs.filter((blog) => {
    const matchesSearch =
      blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      blog.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      blog.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTag = selectedTag === "all" || blog.tags.includes(selectedTag)
    return matchesSearch && matchesTag && blog.status === "published"
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const truncateContent = (content: string, maxLength = 200) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + "..."
  }

  if (isLoading) {
    return (
      <div className="container py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-6xl mx-auto">
        {/* 页面头部 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">旅行游记</h1>
            <p className="text-muted-foreground">分享您的旅行故事，发现他人的精彩旅程</p>
          </div>
          <Button asChild>
            <Link href="/blogs/create">
              <Plus className="h-4 w-4 mr-2" />
              写游记
            </Link>
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索游记、目的地..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedTag === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTag("all")}
            >
              全部
            </Button>
            {allTags.slice(0, 6).map((tag) => (
              <Button
                key={tag}
                variant={selectedTag === tag ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTag(tag)}
              >
                {tag}
              </Button>
            ))}
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 游记列表 */}
        {filteredBlogs.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无游记</h3>
            <p className="text-muted-foreground mb-4">还没有找到符合条件的游记</p>
            <Button asChild>
              <Link href="/blogs/create">
                <Plus className="h-4 w-4 mr-2" />
                写第一篇游记
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filteredBlogs.map((blog) => (
              <Card key={blog.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* 游记图片 */}
                {blog.images.length > 0 && (
                  <div className="h-48 bg-muted flex items-center justify-center overflow-hidden">
                    <img
                      src={blog.images[0] || "/placeholder.svg"}
                      alt={blog.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2 line-clamp-2">
                        <Link href={`/blogs/${blog.id}`} className="hover:text-primary">
                          {blog.title}
                        </Link>
                      </CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {blog.destination}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(blog.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* 作者信息 */}
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={blog.author.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{blog.author.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{blog.author.name}</span>
                  </div>

                  {/* 游记内容预览 */}
                  <p className="text-muted-foreground mb-4 line-clamp-3">{truncateContent(blog.content)}</p>

                  {/* 标签 */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {blog.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {blog.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{blog.tags.length - 3}
                      </Badge>
                    )}
                  </div>

                  <Separator className="mb-4" />

                  {/* 互动按钮 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(blog.id)}
                        className={blog.likedBy.includes("currentUser") ? "text-red-500" : ""}
                      >
                        <Heart
                          className={`h-4 w-4 mr-1 ${blog.likedBy.includes("currentUser") ? "fill-current" : ""}`}
                        />
                        {blog.likes}
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/blogs/${blog.id}`}>
                          <MessageCircle className="h-4 w-4 mr-1" />
                          {blog.comments.length}
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Share2 className="h-4 w-4 mr-1" />
                        分享
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/blogs/${blog.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        阅读全文
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
