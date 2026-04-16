"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Heart, MessageCircle, Share2, Calendar, MapPin, ArrowLeft,
  Send, Loader2, CornerDownRight, X,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { blogAPI } from "@/lib/api"
import { useUserStore } from "@/lib/store/user-store"

interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar: string
  content: string
  parentId?: string | null
  createdAt: string
}

interface Blog {
  id: string
  userId: string
  title: string
  content: string
  coverImage?: string
  images?: string[]
  destination?: string
  tags?: string[]
  likes: number
  likedBy?: string[]
  comments?: Comment[]
  author?: { name: string; avatar: string }
  status: "draft" | "pending" | "published"
  createdAt: string
  updatedAt: string
}

/** Build a tree: top-level comments + their replies */
function buildTree(flat: Comment[]) {
  const roots: Comment[] = []
  const replyMap: Record<string, Comment[]> = {}

  for (const c of flat) {
    if (c.parentId) {
      if (!replyMap[c.parentId]) replyMap[c.parentId] = []
      replyMap[c.parentId].push(c)
    } else {
      roots.push(c)
    }
  }
  return { roots, replyMap }
}

export default function BlogDetailPage() {
  const params = useParams()
  const { toast } = useToast()
  const { user } = useUserStore()
  const [blog, setBlog] = useState<Blog | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // comment state
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)

  useEffect(() => { fetchBlog() }, [params.id])

  const fetchBlog = async () => {
    try {
      setIsLoading(true)
      const data = await blogAPI.getBlog(params.id as string)
      setBlog(data)
    } catch {
      toast({ title: "加载失败", description: "无法加载游记", variant: "destructive" })
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
      setIsSubmitting(true)
      const comment = await blogAPI.addComment(params.id as string, newComment.trim(), replyTo?.id)
      setBlog({ ...blog, comments: [...(blog.comments ?? []), comment] })
      setNewComment("")
      setReplyTo(null)
      toast({ title: replyTo ? "回复成功" : "评论成功" })
    } catch {
      toast({ title: "发送失败", description: "请稍后再试", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("zh-CN", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    })

  const { roots, replyMap } = useMemo(
    () => buildTree(blog?.comments ?? []),
    [blog?.comments]
  )

  if (isLoading) {
    return (
      <div className="w-full py-8 flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="w-full py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">游记不存在</h1>
          <Button asChild>
            <Link href="/blogs"><ArrowLeft className="h-4 w-4 mr-2" />返回游记列表</Link>
          </Button>
        </div>
      </div>
    )
  }

  const likedBy = blog.likedBy ?? []
  const tags = blog.tags ?? []
  const isLiked = likedBy.includes("currentUser")
  const allComments = blog.comments ?? []

  return (
    <div className="w-full py-8">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-6" asChild>
          <Link href="/blogs"><ArrowLeft className="h-4 w-4 mr-2" />返回游记列表</Link>
        </Button>

        {/* 游记内容 */}
        <Card className="mb-8">
          <CardHeader>
            <div className="mb-4">
              <CardTitle className="text-3xl mb-4">{blog.title}</CardTitle>
              <div className="flex items-center gap-6 text-muted-foreground">
                {blog.destination && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />{blog.destination}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />{formatDate(blog.createdAt)}
                </div>
              </div>
            </div>

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

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
              </div>
            )}

            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={handleLike} className={isLiked ? "text-red-500" : ""}>
                <Heart className={`h-4 w-4 mr-2 ${isLiked ? "fill-current" : ""}`} />
                {blog.likes} 点赞
              </Button>
              <Button variant="ghost">
                <MessageCircle className="h-4 w-4 mr-2" />{allComments.length} 评论
              </Button>
              <Button variant="ghost">
                <Share2 className="h-4 w-4 mr-2" />分享
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {blog.coverImage && (
              <div className="mb-6 rounded-lg overflow-hidden h-64 bg-muted">
                <img src={blog.coverImage} alt="封面" className="w-full h-full object-cover" />
              </div>
            )}
            <div
              className="prose prose-lg max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: blog.content }}
            />
          </CardContent>
        </Card>

        {/* 评论区 */}
        <Card>
          <CardHeader>
            <CardTitle>评论 ({allComments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 发表评论输入框 */}
            <div className="mb-6">
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                  <CornerDownRight className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>回复 <strong>{replyTo.userName}</strong>：{replyTo.content.slice(0, 40)}{replyTo.content.length > 40 ? "..." : ""}</span>
                  <button onClick={() => setReplyTo(null)} className="ml-auto hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <Textarea
                placeholder={replyTo ? `回复 ${replyTo.userName}...` : "写下您的评论..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="mb-3"
                rows={3}
              />
              <div className="flex justify-between items-center">
                {replyTo && (
                  <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                    取消回复
                  </Button>
                )}
                <Button
                  className="ml-auto"
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || isSubmitting}
                >
                  {isSubmitting
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />发送中...</>
                    : <><Send className="h-4 w-4 mr-2" />{replyTo ? "发送回复" : "发表评论"}</>
                  }
                </Button>
              </div>
            </div>

            <Separator className="mb-6" />

            {/* 评论树 */}
            <div className="space-y-5">
              {roots.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">暂无评论，来发表第一条吧！</p>
              ) : (
                roots.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    replies={replyMap[comment.id] ?? []}
                    replyMap={replyMap}
                    onReply={setReplyTo}
                    formatDate={formatDate}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── CommentItem ────────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  replies,
  replyMap,
  onReply,
  formatDate,
  depth = 0,
}: {
  comment: Comment
  replies: Comment[]
  replyMap: Record<string, Comment[]>
  onReply: (c: Comment) => void
  formatDate: (s: string) => string
  depth?: number
}) {
  return (
    <div className={depth > 0 ? "ml-10 mt-3" : ""}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.userAvatar || "/placeholder.svg"} />
          <AvatarFallback>{comment.userName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{comment.userName}</span>
            <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
          </div>
          <p className="text-sm leading-relaxed break-words">{comment.content}</p>
          <button
            onClick={() => onReply(comment)}
            className="mt-1.5 text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            <CornerDownRight className="h-3 w-3" />
            回复
          </button>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-3 space-y-3 ml-10 pl-3 border-l-2 border-muted">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replies={replyMap[reply.id] ?? []}
              replyMap={replyMap}
              onReply={onReply}
              formatDate={formatDate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
