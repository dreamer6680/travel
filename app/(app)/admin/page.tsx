"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users, MapPin, FileText, BarChart3, Plus, Edit, Trash2, Search, Shield, Star,
  Globe, Eye, EyeOff, MoreVertical, Loader2, RefreshCw,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { blogAPI } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: number
  name: string
  email: string
  role: "user" | "admin"
  joinDate: string
  stats: { totalTrips: number; countriesVisited: number }
}

interface AdminAttraction {
  id: number
  name: string
  location: string
  rating: number
  type: string
  description: string
}

interface AdminBlog {
  id: string
  title: string
  /** DB 中可能是对象 { name, avatar } 或旧格式字符串 */
  author: { name: string; avatar?: string } | string
  destination: string
  content?: string
  coverImage?: string
  likes: number
  status: "pending" | "published" | "draft"
  createdAt: string
  updatedAt?: string
}

/** 从 author 字段取出显示名 */
function authorName(author: AdminBlog["author"]): string {
  if (!author) return "—"
  if (typeof author === "string") return author || "—"
  return author.name || "—"
}

const EMPTY_BLOG: Omit<AdminBlog, "id" | "likes" | "createdAt"> = {
  title: "",
  author: "",
  destination: "",
  content: "",
  coverImage: "",
  status: "pending",
}

const ATTRACTION_TYPES = ["观景台", "博物馆", "自然景观", "历史建筑", "公园", "艺术展览"]

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { toast } = useToast()

  // ─ Mock user/attraction data (unchanged) ─
  const [users] = useState<AdminUser[]>([
    { id: 1, name: "张三", email: "zhangsan@example.com", role: "user", joinDate: "2024-01-15", stats: { totalTrips: 12, countriesVisited: 8 } },
    { id: 2, name: "李四", email: "lisi@example.com", role: "user", joinDate: "2024-02-20", stats: { totalTrips: 5, countriesVisited: 3 } },
  ])
  const [attractions, setAttractions] = useState<AdminAttraction[]>([
    { id: 1, name: "东京塔", location: "东京, 日本", rating: 4.7, type: "观景台", description: "东京的标志性建筑" },
    { id: 2, name: "巴黎铁塔", location: "巴黎, 法国", rating: 4.8, type: "观景台", description: "法国最著名的地标" },
  ])

  // ─ Blog state ─
  const [blogs, setBlogs] = useState<AdminBlog[]>([])
  const [blogsLoading, setBlogsLoading] = useState(true)
  const [blogSearch, setBlogSearch] = useState("")
  const [blogStatusFilter, setBlogStatusFilter] = useState<"all" | "published" | "pending">("all")

  // ─ Blog dialog state ─
  const [blogDialogOpen, setBlogDialogOpen] = useState(false)
  const [editingBlog, setEditingBlog] = useState<AdminBlog | null>(null)
  const [blogForm, setBlogForm] = useState(EMPTY_BLOG)
  const [blogSaving, setBlogSaving] = useState(false)

  // ─ Delete confirm ─
  const [deleteTarget, setDeleteTarget] = useState<AdminBlog | null>(null)

  // ─ Attraction state ─
  const [attractionSearch, setAttractionSearch] = useState("")
  const [attractionDialogOpen, setAttractionDialogOpen] = useState(false)
  const [editingAttraction, setEditingAttraction] = useState<AdminAttraction | null>(null)
  const [attractionForm, setAttractionForm] = useState({ name: "", location: "", rating: 4.5, type: "", description: "" })
  const [attractionSaving, setAttractionSaving] = useState(false)

  // ── Fetch blogs ───────────────────────────────────────────────────────────

  const fetchBlogs = useCallback(async () => {
    try {
      setBlogsLoading(true)
      const data = await blogAPI.getAllBlogs()
      setBlogs(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast({ title: "加载游记失败", description: err.message, variant: "destructive" })
    } finally {
      setBlogsLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchBlogs() }, [fetchBlogs])

  // ── Blog CRUD ─────────────────────────────────────────────────────────────

  const openCreateBlog = () => {
    setEditingBlog(null)
    setBlogForm(EMPTY_BLOG)
    setBlogDialogOpen(true)
  }

  const openEditBlog = (blog: AdminBlog) => {
    setEditingBlog(blog)
    setBlogForm({
      title: blog.title,
      author: authorName(blog.author),
      destination: blog.destination,
      content: blog.content ?? "",
      coverImage: blog.coverImage ?? "",
      status: blog.status,
    })
    setBlogDialogOpen(true)
  }

  const handleSaveBlog = async () => {
    if (!blogForm.title.trim()) {
      toast({ title: "请填写游记标题", variant: "destructive" })
      return
    }
    try {
      setBlogSaving(true)
      // 将表单中的 author 字符串转换为对象格式存储
      const authorStr = (blogForm.author as string).trim()
      const payload = {
        ...blogForm,
        author: { name: authorStr || "管理员", avatar: "" },
      }
      if (editingBlog) {
        await blogAPI.updateBlog(editingBlog.id, payload)
        setBlogs((prev) => prev.map((b) => b.id === editingBlog.id ? { ...b, ...payload } : b))
        toast({ title: "游记已更新" })
      } else {
        const created = await blogAPI.createBlog(payload)
        setBlogs((prev) => [created, ...prev])
        toast({ title: "游记已创建" })
      }
      setBlogDialogOpen(false)
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" })
    } finally {
      setBlogSaving(false)
    }
  }

  const handleApprove = async (blog: AdminBlog) => {
    const originalBlogs = blogs
    setBlogs((prev) => prev.map((b) => b.id === blog.id ? { ...b, status: "published" } : b))
    try {
      await blogAPI.togglePublish(blog.id, "published")
      toast({ title: "审核通过", description: "游记已公开发布" })
    } catch (err: any) {
      setBlogs(originalBlogs)
      toast({ title: "操作失败", description: err.message, variant: "destructive" })
    }
  }

  const handleUnpublish = async (blog: AdminBlog) => {
    const originalBlogs = blogs
    setBlogs((prev) => prev.map((b) => b.id === blog.id ? { ...b, status: "pending" } : b))
    try {
      await blogAPI.togglePublish(blog.id, "pending")
      toast({ title: "已下架", description: "游记已重新进入待审核" })
    } catch (err: any) {
      setBlogs(originalBlogs)
      toast({ title: "操作失败", description: err.message, variant: "destructive" })
    }
  }

  const handleDeleteBlog = async () => {
    if (!deleteTarget) return
    const originalBlogs = blogs
    setBlogs((prev) => prev.filter((b) => b.id !== deleteTarget.id))
    setDeleteTarget(null)
    try {
      await blogAPI.deleteBlog(deleteTarget.id)
      toast({ title: "游记已删除" })
    } catch (err: any) {
      setBlogs(originalBlogs)
      toast({ title: "删除失败", description: err.message, variant: "destructive" })
    }
  }

  const filteredBlogs = blogs.filter((b) => {
    const q = blogSearch.toLowerCase()
    const matchSearch = b.title.toLowerCase().includes(q) || authorName(b.author).toLowerCase().includes(q) || b.destination.toLowerCase().includes(q)
    const matchStatus = blogStatusFilter === "all" || b.status === blogStatusFilter
    return matchSearch && matchStatus
  })

  // ── Attraction CRUD (local only) ──────────────────────────────────────────

  const openCreateAttraction = () => {
    setEditingAttraction(null)
    setAttractionForm({ name: "", location: "", rating: 4.5, type: "", description: "" })
    setAttractionDialogOpen(true)
  }

  const openEditAttraction = (a: AdminAttraction) => {
    setEditingAttraction(a)
    setAttractionForm({ name: a.name, location: a.location, rating: a.rating, type: a.type, description: a.description })
    setAttractionDialogOpen(true)
  }

  const handleSaveAttraction = () => {
    if (editingAttraction) {
      setAttractions((prev) => prev.map((a) => a.id === editingAttraction.id ? { ...editingAttraction, ...attractionForm } : a))
      toast({ title: "景点已更新" })
    } else {
      const newId = Math.max(0, ...attractions.map((a) => a.id)) + 1
      setAttractions((prev) => [...prev, { id: newId, ...attractionForm }])
      toast({ title: "景点已添加" })
    }
    setAttractionDialogOpen(false)
  }

  const handleDeleteAttraction = (id: number) => {
    setAttractions((prev) => prev.filter((a) => a.id !== id))
    toast({ title: "景点已删除" })
  }

  const filteredAttractions = attractions.filter(
    (a) => a.name.toLowerCase().includes(attractionSearch.toLowerCase()) || a.location.toLowerCase().includes(attractionSearch.toLowerCase())
  )

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = [
    { icon: <Users className="h-7 w-7 text-blue-500" />, label: "总用户数", value: users.length, bg: "bg-blue-50 dark:bg-blue-950/20" },
    { icon: <MapPin className="h-7 w-7 text-emerald-500" />, label: "景点数量", value: attractions.length, bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { icon: <FileText className="h-7 w-7 text-purple-500" />, label: "游记总数", value: blogs.length, bg: "bg-purple-50 dark:bg-purple-950/20" },
    { icon: <Globe className="h-7 w-7 text-orange-500" />, label: "待审核", value: blogs.filter((b) => b.status === "pending").length, bg: "bg-orange-50 dark:bg-orange-950/20" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">后台管理</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ icon, label, value, bg }) => (
          <Card key={label} className={bg}>
            <CardContent className="p-5 flex items-center gap-4">
              {icon}
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="blogs">
        <TabsList className="grid grid-cols-3 w-full max-w-sm">
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="attractions">景点管理</TabsTrigger>
          <TabsTrigger value="blogs">游记管理</TabsTrigger>
        </TabsList>

        {/* ── 用户管理 ── */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>用户管理</CardTitle>
              <CardDescription>管理系统中的所有用户账户</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>行程数</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role === "admin" ? "管理员" : "用户"}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.joinDate}</TableCell>
                      <TableCell>{user.stats.totalTrips}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 景点管理 ── */}
        <TabsContent value="attractions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>景点管理</CardTitle>
                  <CardDescription>管理系统景点信息</CardDescription>
                </div>
                <Button onClick={openCreateAttraction}>
                  <Plus className="h-4 w-4 mr-2" />添加景点
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="搜索景点..." value={attractionSearch} onChange={(e) => setAttractionSearch(e.target.value)} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>景点名称</TableHead>
                    <TableHead>位置</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>评分</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttractions.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground">{a.location}</TableCell>
                      <TableCell><Badge variant="outline">{a.type}</Badge></TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />{a.rating}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditAttraction(a)}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>确定要删除景点"{a.name}"？此操作无法撤销。</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAttraction(a.id)}>删除</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteAttraction(a.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 游记管理 ── */}
        <TabsContent value="blogs">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>游记管理</CardTitle>
                  <CardDescription>管理游记内容，支持发布 / 下架 / 编辑 / 删除</CardDescription>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="icon" onClick={fetchBlogs} disabled={blogsLoading}>
                    <RefreshCw className={`h-4 w-4 ${blogsLoading ? "animate-spin" : ""}`} />
                  </Button>
                  <Button onClick={openCreateBlog}>
                    <Plus className="h-4 w-4 mr-2" />新建游记
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search + filter */}
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-10" placeholder="搜索标题、作者、目的地..." value={blogSearch} onChange={(e) => setBlogSearch(e.target.value)} />
                </div>
                <Select value={blogStatusFilter} onValueChange={(v) => setBlogStatusFilter(v as any)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="pending">待审核</SelectItem>
                    <SelectItem value="published">已发布</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {blogsLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredBlogs.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>{blogSearch || blogStatusFilter !== "all" ? "没有符合条件的游记" : '暂无游记，点击"新建游记"开始创作'}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>标题</TableHead>
                      <TableHead>作者</TableHead>
                      <TableHead>目的地</TableHead>
                      <TableHead>点赞</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBlogs.map((blog) => (
                      <TableRow key={blog.id}>
                        <TableCell className="font-medium max-w-[180px] truncate">{blog.title}</TableCell>
                        <TableCell className="text-muted-foreground">{authorName(blog.author)}</TableCell>
                        <TableCell>{blog.destination || "—"}</TableCell>
                        <TableCell>{blog.likes ?? 0}</TableCell>
                        <TableCell>
                          <Badge
                            variant={blog.status === "published" ? "default" : blog.status === "pending" ? "outline" : "secondary"}
                            className="whitespace-nowrap"
                          >
                            {blog.status === "published" ? "已发布" : blog.status === "pending" ? "待审核" : "草稿"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(blog.createdAt).toLocaleDateString("zh-CN")}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditBlog(blog)}>
                                <Edit className="h-4 w-4 mr-2" />编辑
                              </DropdownMenuItem>
                              {blog.status === "pending" && (
                                <DropdownMenuItem onClick={() => handleApprove(blog)}>
                                  <Eye className="h-4 w-4 mr-2" />审核通过
                                </DropdownMenuItem>
                              )}
                              {blog.status === "published" && (
                                <DropdownMenuItem onClick={() => handleUnpublish(blog)}>
                                  <EyeOff className="h-4 w-4 mr-2" />下架
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(blog)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Blog create/edit dialog ── */}
      <Dialog open={blogDialogOpen} onOpenChange={setBlogDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBlog ? "编辑游记" : "新建游记"}</DialogTitle>
            <DialogDescription>{editingBlog ? "修改游记内容后保存" : "填写游记基本信息，之后可继续完善"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>标题 <span className="text-destructive">*</span></Label>
                <Input placeholder="游记标题" value={blogForm.title} onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>目的地</Label>
                <Input placeholder="如：东京, 日本" value={blogForm.destination} onChange={(e) => setBlogForm({ ...blogForm, destination: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>作者</Label>
                <Input placeholder="作者名称" value={blogForm.author} onChange={(e) => setBlogForm({ ...blogForm, author: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>发布状态</Label>
                <Select value={blogForm.status} onValueChange={(v: "pending" | "published") => setBlogForm({ ...blogForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">待审核</SelectItem>
                    <SelectItem value="published">立即发布</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>封面图片 URL</Label>
              <Input placeholder="https://..." value={blogForm.coverImage} onChange={(e) => setBlogForm({ ...blogForm, coverImage: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>正文内容</Label>
              <Textarea
                placeholder="支持 Markdown 格式..."
                rows={10}
                value={blogForm.content}
                onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                className="font-mono text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBlogDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveBlog} disabled={blogSaving}>
              {blogSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</> : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除游记</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除游记「{deleteTarget?.title}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteBlog}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Attraction dialog ── */}
      <Dialog open={attractionDialogOpen} onOpenChange={setAttractionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAttraction ? "编辑景点" : "添加景点"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>景点名称</Label>
                <Input value={attractionForm.name} onChange={(e) => setAttractionForm({ ...attractionForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>位置</Label>
                <Input value={attractionForm.location} onChange={(e) => setAttractionForm({ ...attractionForm, location: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={attractionForm.type} onValueChange={(v) => setAttractionForm({ ...attractionForm, type: v })}>
                  <SelectTrigger><SelectValue placeholder="选择类型" /></SelectTrigger>
                  <SelectContent>
                    {ATTRACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>评分 (1–5)</Label>
                <Input type="number" min={1} max={5} step={0.1} value={attractionForm.rating}
                  onChange={(e) => setAttractionForm({ ...attractionForm, rating: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea rows={3} value={attractionForm.description} onChange={(e) => setAttractionForm({ ...attractionForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttractionDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveAttraction} disabled={attractionSaving}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
