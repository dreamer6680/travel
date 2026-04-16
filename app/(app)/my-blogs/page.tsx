"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus, Search, Eye, Edit, Trash2, MoreVertical, Loader2,
  FileText, Calendar, MapPin, Heart, MessageCircle, RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { blogAPI } from "@/lib/api"

interface MyBlog {
  id: string
  title: string
  destination?: string
  content: string
  tags?: string[]
  likes: number
  comments?: unknown[]
  status: "draft" | "pending" | "published"
  createdAt: string
  updatedAt: string
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "outline" | "secondary" }> = {
  published: { label: "已发布", variant: "default" },
  pending:   { label: "待审核", variant: "outline" },
  draft:     { label: "草稿",   variant: "secondary" },
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export default function MyBlogsPage() {
  const { toast } = useToast()
  const [blogs, setBlogs] = useState<MyBlog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "pending" | "published">("all")
  const [deleteTarget, setDeleteTarget] = useState<MyBlog | null>(null)

  useEffect(() => { fetchMyBlogs() }, [])

  const fetchMyBlogs = async () => {
    try {
      setIsLoading(true)
      const data = await blogAPI.getMyBlogs()
      setBlogs(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast({ title: "加载失败", description: err.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const original = blogs
    setBlogs((prev) => prev.filter((b) => b.id !== deleteTarget.id))
    setDeleteTarget(null)
    try {
      await blogAPI.deleteBlog(deleteTarget.id)
      toast({ title: "已删除" })
    } catch (err: any) {
      setBlogs(original)
      toast({ title: "删除失败", description: err.message, variant: "destructive" })
    }
  }

  const filtered = blogs.filter((b) => {
    const q = searchQuery.toLowerCase()
    const matchSearch =
      b.title.toLowerCase().includes(q) ||
      (b.destination ?? "").toLowerCase().includes(q) ||
      stripHtml(b.content).toLowerCase().includes(q)
    const matchStatus = statusFilter === "all" || b.status === statusFilter
    return matchSearch && matchStatus
  })

  const counts = {
    all: blogs.length,
    published: blogs.filter((b) => b.status === "published").length,
    pending: blogs.filter((b) => b.status === "pending").length,
    draft: blogs.filter((b) => b.status === "draft").length,
  }

  return (
    <div className="w-full py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">我的游记</h1>
            <p className="text-muted-foreground">管理您创作的所有游记</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchMyBlogs} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button asChild>
              <Link href="/blogs/create">
                <Plus className="h-4 w-4 mr-2" />写游记
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["all", "published", "pending", "draft"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${statusFilter === s ? "bg-muted border-primary" : ""}`}
            >
              <p className="text-xs text-muted-foreground mb-1">
                {s === "all" ? "全部" : STATUS_MAP[s].label}
              </p>
              <p className="text-2xl font-bold">{counts[s]}</p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="搜索标题、目的地..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="mb-4">
              {searchQuery || statusFilter !== "all" ? "没有符合条件的游记" : "还没有游记，快去创作第一篇吧"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button asChild>
                <Link href="/blogs/create">
                  <Plus className="h-4 w-4 mr-2" />写第一篇游记
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((blog) => {
              const statusInfo = STATUS_MAP[blog.status] ?? STATUS_MAP.draft
              return (
                <Card key={blog.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          {blog.destination && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {blog.destination}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(blog.createdAt).toLocaleDateString("zh-CN")}
                          </span>
                        </div>
                        <CardTitle className="text-lg line-clamp-1">{blog.title}</CardTitle>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="flex-shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {blog.status === "published" && (
                            <DropdownMenuItem asChild>
                              <Link href={`/blogs/${blog.id}`}>
                                <Eye className="h-4 w-4 mr-2" />查看
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <Link href={`/blogs/create?edit=${blog.id}`}>
                              <Edit className="h-4 w-4 mr-2" />编辑
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(blog)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {stripHtml(blog.content).substring(0, 200) || "暂无内容"}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />{blog.likes ?? 0} 点赞
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {Array.isArray(blog.comments) ? blog.comments.length : 0} 评论
                      </span>
                      {blog.status === "pending" && (
                        <span className="text-amber-500">审核中，请耐心等待</span>
                      )}
                      {blog.status === "draft" && (
                        <span className="text-muted-foreground">草稿未提交，仅自己可见</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除游记「{deleteTarget?.title}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
