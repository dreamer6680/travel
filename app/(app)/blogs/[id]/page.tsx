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
import { blogAPI } from "@/lib/api"

interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar: string
  content: string
  createdAt: string
}

interface Blog {
  id: string
  userId: string
  title: string
  content: string
  images?: string[]
  destination?: string
  tags?: string[]
  likes: number
  likedBy?: string[]
  comments?: Comment[]
  author?: {
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
      const data = await blogAPI.getBlog(params.id as string)
      setBlog(data)
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

  const handleLike = () => {
    if (!blog) return
    const likedBy = blog.likedBy ?? []
    const isLiked = likedBy.includes("currentUser")
    setBlog({
      ...blog,
      likes: isLiked ? blog.likes - 1 : blog.likes + 1,
      likedBy: isLiked
        ? likedBy.filter((id) => id !== "currentUser")
        : [...likedBy, "currentUser"],
    })
  }

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !blog) return

    try {
      setIsSubmittingComment(true)
      const comment: Comment = {
        id: `comment${Date.now()}`,
        userId: "currentUser",
        userName: "当前用户",
        userAvatar: "/placeholder.svg",
        content: newComment,
        createdAt: new Date().toISOString(),
      }
      setBlog({
        ...blog,
        comments: [...(blog.comments ?? []), comment],
      })
      setNewComment("")
      toast({ title: "评论成功", description: "您的评论已发布" })
    } catch (error) {
      toast({ title: "评论失败", description: "请稍后再试", variant: "destructive" })
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

  if (isLoading) {
    return (
      <div className="w-full py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg">加载中...</p>
        </div>
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="w-full py-8">
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

  const likedBy = blog.likedBy ?? []
  const tags = blog.tags ?? []
  const comments = blog.comments ?? []
  const isLiked = likedBy.includes("currentUser")

  return (
    <div className="w-full py-8">
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
                  {blog.destination && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {blog.destination}
                    </div>
                  )}
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
                <AvatarImage src={blog.author?.avatar ?? "/placeholder.svg"} />
                <AvatarFallback>{blog.author?.name?.charAt(0) ?? "?"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{blog.author?.name ?? "匿名作者"}</p>
                <p className="text-sm text-muted-foreground">旅行爱好者</p>
              </div>
            </div>

            {/* 标签 */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* 互动按钮 */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={handleLike}
                className={isLiked ? "text-red-500" : ""}
              >
                <Heart className={`h-4 w-4 mr-2 ${isLiked ? "fill-current" : ""}`} />
                {blog.likes} 点赞
              </Button>
              <Button variant="ghost">
                <MessageCircle className="h-4 w-4 mr-2" />
                {comments.length} 评论
              </Button>
              <Button variant="ghost">
                <Share2 className="h-4 w-4 mr-2" />
                分享
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* 渲染富文本 HTML 内容 */}
            <div
              className="prose prose-lg max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: blog.content }}
            />
          </CardContent>
        </Card>

        {/* 评论区 */}
        <Card>
          <CardHeader>
            <CardTitle>评论 ({comments.length})</CardTitle>
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
              {comments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">暂无评论，快来发表第一条评论吧！</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={comment.userAvatar ?? "/placeholder.svg"} />
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
