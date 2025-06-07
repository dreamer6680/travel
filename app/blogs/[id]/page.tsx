"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Heart, MessageCircle, Share2, Calendar, MapPin, ArrowLeft, Send, Loader2 } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"

interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar: string
  content: string
  createdAt: string
}

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
  comments: Comment[]
  author: {
    name: string
    avatar: string
  }
  status: "draft" | "published"
  createdAt: string
  updatedAt: string
}

export default function BlogDetailPage() {
  const params = useParams()
  const { toast } = useToast()
  const [blog, setBlog] = useState<Blog | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  useEffect(() => {
    fetchBlog()
  }, [params.id])

  const fetchBlog = async () => {
    try {
      setIsLoading(true)
      // 模拟API调用
      const mockBlog: Blog = {
        id: 1,
        userId: "user1",
        title: "东京5日游：传统与现代的完美融合",
        content: `# 东京之旅

这次东京之行真的让我印象深刻！从传统的浅草寺到现代的晴空塔，东京完美地融合了传统与现代。

## 第一天：浅草寺与晴空塔

早上我们首先来到了浅草寺，这里是东京最古老的寺庙。仲见世通的小吃和纪念品让人目不暇接，特别推荐人形烧和雷门饼干。

![浅草寺](/placeholder.svg?height=400&width=600)

下午登上了晴空塔，634米的高度让整个东京尽收眼底。夜景更是美得令人窒息！

![晴空塔夜景](/placeholder.svg?height=400&width=600)

## 第二天：银座购物与美食

银座是购物的天堂，从奢侈品牌到日本本土品牌，应有尽有。中午在银座的一家老字号寿司店用餐，师傅的手艺真的是炉火纯青。

## 第三天：原宿与涩谷

原宿的年轻文化让人眼前一亮，各种奇装异服的年轻人在这里展示着自己的个性。涩谷的十字路口更是壮观，成千上万的人同时过马路，场面震撼。

## 美食体验

东京的美食真的是太棒了！从浅草的传统寿司到银座的高级料理，每一餐都是享受。特别推荐：

- **筑地市场的海鲜丼**：新鲜到爆炸的海鲜，价格也很合理
- **一兰拉面**：虽然是连锁店，但味道确实不错
- **银座的寿司**：虽然价格不菲，但绝对物有所值
- **原宿的可丽饼**：年轻人的最爱，口味丰富

![美食拼图](/placeholder.svg?height=400&width=600)

## 购物天堂

银座、涩谷、原宿...每个区域都有不同的购物体验：

- **银座**：奢侈品和高端商品的聚集地
- **涩谷**：年轻时尚的代表，109大厦是必去之地
- **原宿**：个性化商品和二次元文化的天堂
- **秋叶原**：电子产品和动漫周边的圣地

## 交通体验

东京的交通系统真的很发达，地铁四通八达。建议购买一日券或者三日券，会比较划算。不过要注意的是，早晚高峰期真的很挤，要做好心理准备。

## 文化体验

除了现代化的一面，东京也保留着很多传统文化：

- **浅草寺**：感受传统日本的宗教文化
- **明治神宫**：在都市中的一片净土
- **皇居**：虽然不能进入，但外围的景色也很美
- **上野公园**：樱花季节的绝佳去处

## 总结

总的来说，这次东京之行超出了我的期待。这座城市既有现代化的繁华，又保留着传统的韵味。无论是美食、购物还是文化体验，都让人流连忘返。

已经开始计划下次的京都之旅了！如果你也在计划去日本旅行，强烈推荐东京作为第一站。

**小贴士：**
- 提前下载Google翻译和换乘案内APP
- 准备一些现金，很多小店不接受信用卡
- 学会基本的日语问候语，日本人会很开心
- 尊重当地文化，特别是在寺庙和神社`,
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
          {
            id: "comment3",
            userId: "user4",
            userName: "赵六",
            userAvatar: "/placeholder.svg?height=40&width=40",
            content: "筑地市场的海鲜丼我也吃过，确实很新鲜！下次去东京一定要再去一次",
            createdAt: "2025-01-05T16:45:00Z",
          },
        ],
        author: {
          name: "张三",
          avatar: "/placeholder.svg?height=40&width=40",
        },
        status: "published",
        createdAt: "2025-01-05T08:00:00Z",
        updatedAt: "2025-01-05T08:00:00Z",
      }

      setBlog(mockBlog)
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

  const handleLike = async () => {
    if (!blog) return

    try {
      const isLiked = blog.likedBy.includes("currentUser")
      setBlog({
        ...blog,
        likes: isLiked ? blog.likes - 1 : blog.likes + 1,
        likedBy: isLiked ? blog.likedBy.filter((id) => id !== "currentUser") : [...blog.likedBy, "currentUser"],
      })
    } catch (error) {
      toast({
        title: "操作失败",
        description: "请稍后再试",
        variant: "destructive",
      })
    }
  }

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !blog) return

    try {
      setIsSubmittingComment(true)
      const comment: Comment = {
        id: `comment${Date.now()}`,
        userId: "currentUser",
        userName: "当前用户",
        userAvatar: "/placeholder.svg?height=40&width=40",
        content: newComment,
        createdAt: new Date().toISOString(),
      }

      setBlog({
        ...blog,
        comments: [...blog.comments, comment],
      })
      setNewComment("")
      toast({
        title: "评论成功",
        description: "您的评论已发布",
      })
    } catch (error) {
      toast({
        title: "评论失败",
        description: "请稍后再试",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatContent = (content: string) => {
    // 简单的markdown渲染
    return content.split("\n").map((line, index) => {
      if (line.startsWith("# ")) {
        return (
          <h1 key={index} className="text-3xl font-bold mt-8 mb-4 first:mt-0">
            {line.substring(2)}
          </h1>
        )
      }
      if (line.startsWith("## ")) {
        return (
          <h2 key={index} className="text-2xl font-semibold mt-6 mb-3">
            {line.substring(3)}
          </h2>
        )
      }
      if (line.startsWith("### ")) {
        return (
          <h3 key={index} className="text-xl font-medium mt-4 mb-2">
            {line.substring(4)}
          </h3>
        )
      }
      if (line.startsWith("![")) {
        const match = line.match(/!\[([^\]]*)\]$$([^)]+)$$/)
        if (match) {
          return (
            <div key={index} className="my-6">
              <img src={match[2] || "/placeholder.svg"} alt={match[1]} className="w-full rounded-lg" />
            </div>
          )
        }
      }
      if (line.startsWith("- **") && line.includes("**:")) {
        const parts = line.split("**:")
        const title = parts[0].substring(4)
        const description = parts[1]
        return (
          <li key={index} className="mb-2">
            <strong>{title}</strong>: {description}
          </li>
        )
      }
      if (line.startsWith("- ")) {
        return (
          <li key={index} className="mb-1">
            {line.substring(2)}
          </li>
        )
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return (
          <p key={index} className="font-bold my-4">
            {line.slice(2, -2)}
          </p>
        )
      }
      if (line.trim() === "") {
        return <br key={index} />
      }
      return (
        <p key={index} className="mb-4 leading-relaxed">
          {line}
        </p>
      )
    })
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

  if (!blog) {
    return (
      <div className="container py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">游记不存在</h1>
          <p className="text-muted-foreground mb-6">抱歉，您访问的游记不存在或已被删除</p>
          <Button asChild>
            <Link href="/blogs">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回游记列表
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        {/* 返回按钮 */}
        <Button variant="ghost" className="mb-6" asChild>
          <Link href="/blogs">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回游记列表
          </Link>
        </Button>

        {/* 游记内容 */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <CardTitle className="text-3xl mb-4">{blog.title}</CardTitle>
                <div className="flex items-center gap-6 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {blog.destination}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(blog.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* 作者信息 */}
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={blog.author.avatar || "/placeholder.svg"} />
                <AvatarFallback>{blog.author.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{blog.author.name}</p>
                <p className="text-sm text-muted-foreground">旅行爱好者</p>
              </div>
            </div>

            {/* 标签 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {blog.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* 互动按钮 */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={handleLike}
                className={blog.likedBy.includes("currentUser") ? "text-red-500" : ""}
              >
                <Heart className={`h-4 w-4 mr-2 ${blog.likedBy.includes("currentUser") ? "fill-current" : ""}`} />
                {blog.likes} 点赞
              </Button>
              <Button variant="ghost">
                <MessageCircle className="h-4 w-4 mr-2" />
                {blog.comments.length} 评论
              </Button>
              <Button variant="ghost">
                <Share2 className="h-4 w-4 mr-2" />
                分享
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="prose prose-lg max-w-none">{formatContent(blog.content)}</div>
          </CardContent>
        </Card>

        {/* 评论区 */}
        <Card>
          <CardHeader>
            <CardTitle>评论 ({blog.comments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 发表评论 */}
            <div className="mb-6">
              <Textarea
                placeholder="写下您的评论..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="mb-3"
                rows={3}
              />
              <Button onClick={handleSubmitComment} disabled={!newComment.trim() || isSubmittingComment}>
                {isSubmittingComment ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    发布中...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    发表评论
                  </>
                )}
              </Button>
            </div>

            <Separator className="mb-6" />

            {/* 评论列表 */}
            <div className="space-y-6">
              {blog.comments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">暂无评论，快来发表第一条评论吧！</p>
              ) : (
                blog.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={comment.userAvatar || "/placeholder.svg"} />
                      <AvatarFallback>{comment.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{comment.userName}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
