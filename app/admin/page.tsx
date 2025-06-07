"use client"

import { useState, useEffect } from "react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Users, MapPin, FileText, BarChart3, Plus, Edit, Trash2, Search, Shield, Star } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface User {
  id: number
  name: string
  email: string
  role: "user" | "admin"
  joinDate: string
  stats: {
    totalTrips: number
    countriesVisited: number
  }
}

interface Attraction {
  id: number
  name: string
  location: string
  rating: number
  type: string
  description: string
  imageUrl: string
}

interface Blog {
  id: number
  title: string
  author: string
  destination: string
  likes: number
  status: "draft" | "published"
  createdAt: string
}

export default function AdminPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [attractions, setAttractions] = useState<Attraction[]>([])
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 新增景点表单状态
  const [newAttraction, setNewAttraction] = useState({
    name: "",
    location: "",
    rating: 5,
    type: "",
    description: "",
    imageUrl: "",
  })

  // 编辑景点状态
  const [editingAttraction, setEditingAttraction] = useState<Attraction | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  // 搜索状态
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      // 模拟API调用
      const mockUsers: User[] = [
        {
          id: 1,
          name: "张三",
          email: "zhangsan@example.com",
          role: "user",
          joinDate: "2024-01-15",
          stats: { totalTrips: 12, countriesVisited: 8 },
        },
        {
          id: 2,
          name: "李四",
          email: "lisi@example.com",
          role: "user",
          joinDate: "2024-02-20",
          stats: { totalTrips: 5, countriesVisited: 3 },
        },
      ]

      const mockAttractions: Attraction[] = [
        {
          id: 1,
          name: "东京塔",
          location: "东京, 日本",
          rating: 4.7,
          type: "观景台",
          description: "东京的标志性建筑",
          imageUrl: "/placeholder.svg?height=200&width=300",
        },
        {
          id: 2,
          name: "巴黎铁塔",
          location: "巴黎, 法国",
          rating: 4.8,
          type: "观景台",
          description: "法国最著名的地标",
          imageUrl: "/placeholder.svg?height=200&width=300",
        },
      ]

      const mockBlogs: Blog[] = [
        {
          id: 1,
          title: "东京5日游记",
          author: "张三",
          destination: "东京, 日本",
          likes: 128,
          status: "published",
          createdAt: "2025-01-05",
        },
        {
          id: 2,
          title: "巴黎浪漫之旅",
          author: "李四",
          destination: "巴黎, 法国",
          likes: 45,
          status: "draft",
          createdAt: "2025-01-06",
        },
      ]

      setUsers(mockUsers)
      setAttractions(mockAttractions)
      setBlogs(mockBlogs)
    } catch (error) {
      toast({
        title: "加载失败",
        description: "无法加载数据，请稍后再试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddAttraction = async () => {
    try {
      const newId = Math.max(...attractions.map((a) => a.id)) + 1
      const attraction = { ...newAttraction, id: newId }
      setAttractions([...attractions, attraction])
      setNewAttraction({
        name: "",
        location: "",
        rating: 5,
        type: "",
        description: "",
        imageUrl: "",
      })
      setIsAddDialogOpen(false)
      toast({
        title: "添加成功",
        description: "景点已成功添加",
      })
    } catch (error) {
      toast({
        title: "添加失败",
        description: "请稍后再试",
        variant: "destructive",
      })
    }
  }

  const handleEditAttraction = async () => {
    if (!editingAttraction) return

    try {
      setAttractions(attractions.map((a) => (a.id === editingAttraction.id ? editingAttraction : a)))
      setEditingAttraction(null)
      setIsEditDialogOpen(false)
      toast({
        title: "更新成功",
        description: "景点信息已更新",
      })
    } catch (error) {
      toast({
        title: "更新失败",
        description: "请稍后再试",
        variant: "destructive",
      })
    }
  }

  const handleDeleteAttraction = async (id: number) => {
    try {
      setAttractions(attractions.filter((a) => a.id !== id))
      toast({
        title: "删除成功",
        description: "景点已删除",
      })
    } catch (error) {
      toast({
        title: "删除失败",
        description: "请稍后再试",
        variant: "destructive",
      })
    }
  }

  const filteredAttractions = attractions.filter(
    (attraction) =>
      attraction.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attraction.location.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (isLoading) {
    return (
      <div className="container py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">后台管理</h1>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">总用户数</p>
                  <p className="text-2xl font-bold">{users.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <MapPin className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">景点数量</p>
                  <p className="text-2xl font-bold">{attractions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <FileText className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">游记数量</p>
                  <p className="text-2xl font-bold">{blogs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <BarChart3 className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-muted-foreground">活跃用户</p>
                  <p className="text-2xl font-bold">{users.filter((u) => u.stats.totalTrips > 0).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="users">用户管理</TabsTrigger>
            <TabsTrigger value="attractions">景点管理</TabsTrigger>
            <TabsTrigger value="blogs">游记管理</TabsTrigger>
          </TabsList>

          {/* 用户管理 */}
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
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role === "admin" ? "管理员" : "用户"}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.joinDate}</TableCell>
                        <TableCell>{user.stats.totalTrips}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    确定要删除用户 "{user.name}" 吗？此操作无法撤销。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction>删除</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 景点管理 */}
          <TabsContent value="attractions">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>景点管理</CardTitle>
                    <CardDescription>管理系统中的景点信息</CardDescription>
                  </div>
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        添加景点
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>添加新景点</DialogTitle>
                        <DialogDescription>填写景点信息</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name">景点名称</Label>
                          <Input
                            id="name"
                            value={newAttraction.name}
                            onChange={(e) => setNewAttraction({ ...newAttraction, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="location">位置</Label>
                          <Input
                            id="location"
                            value={newAttraction.location}
                            onChange={(e) => setNewAttraction({ ...newAttraction, location: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="type">类型</Label>
                          <Select
                            value={newAttraction.type}
                            onValueChange={(value) => setNewAttraction({ ...newAttraction, type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择类型" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="观景台">观景台</SelectItem>
                              <SelectItem value="博物馆">博物馆</SelectItem>
                              <SelectItem value="自然景观">自然景观</SelectItem>
                              <SelectItem value="历史建筑">历史建筑</SelectItem>
                              <SelectItem value="公园">公园</SelectItem>
                              <SelectItem value="艺术展览">艺术展览</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="rating">评分</Label>
                          <Input
                            id="rating"
                            type="number"
                            min="1"
                            max="5"
                            step="0.1"
                            value={newAttraction.rating}
                            onChange={(e) =>
                              setNewAttraction({ ...newAttraction, rating: Number.parseFloat(e.target.value) })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">描述</Label>
                          <Textarea
                            id="description"
                            value={newAttraction.description}
                            onChange={(e) => setNewAttraction({ ...newAttraction, description: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="imageUrl">图片URL</Label>
                          <Input
                            id="imageUrl"
                            value={newAttraction.imageUrl}
                            onChange={(e) => setNewAttraction({ ...newAttraction, imageUrl: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                          取消
                        </Button>
                        <Button onClick={handleAddAttraction}>添加</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索景点..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
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
                    {filteredAttractions.map((attraction) => (
                      <TableRow key={attraction.id}>
                        <TableCell className="font-medium">{attraction.name}</TableCell>
                        <TableCell>{attraction.location}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{attraction.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {attraction.rating}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Dialog
                              open={isEditDialogOpen && editingAttraction?.id === attraction.id}
                              onOpenChange={setIsEditDialogOpen}
                            >
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setEditingAttraction(attraction)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>编辑景点</DialogTitle>
                                  <DialogDescription>修改景点信息</DialogDescription>
                                </DialogHeader>
                                {editingAttraction && (
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor="edit-name">景点名称</Label>
                                      <Input
                                        id="edit-name"
                                        value={editingAttraction.name}
                                        onChange={(e) =>
                                          setEditingAttraction({ ...editingAttraction, name: e.target.value })
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-location">位置</Label>
                                      <Input
                                        id="edit-location"
                                        value={editingAttraction.location}
                                        onChange={(e) =>
                                          setEditingAttraction({ ...editingAttraction, location: e.target.value })
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-type">类型</Label>
                                      <Select
                                        value={editingAttraction.type}
                                        onValueChange={(value) =>
                                          setEditingAttraction({ ...editingAttraction, type: value })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="观景台">观景台</SelectItem>
                                          <SelectItem value="博物馆">博物馆</SelectItem>
                                          <SelectItem value="自然景观">自然景观</SelectItem>
                                          <SelectItem value="历史建筑">历史建筑</SelectItem>
                                          <SelectItem value="公园">公园</SelectItem>
                                          <SelectItem value="艺术展览">艺术展览</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-rating">评分</Label>
                                      <Input
                                        id="edit-rating"
                                        type="number"
                                        min="1"
                                        max="5"
                                        step="0.1"
                                        value={editingAttraction.rating}
                                        onChange={(e) =>
                                          setEditingAttraction({
                                            ...editingAttraction,
                                            rating: Number.parseFloat(e.target.value),
                                          })
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-description">描述</Label>
                                      <Textarea
                                        id="edit-description"
                                        value={editingAttraction.description}
                                        onChange={(e) =>
                                          setEditingAttraction({ ...editingAttraction, description: e.target.value })
                                        }
                                      />
                                    </div>
                                  </div>
                                )}
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                    取消
                                  </Button>
                                  <Button onClick={handleEditAttraction}>保存</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    确定要删除景点 "{attraction.name}" 吗？此操作无法撤销。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteAttraction(attraction.id)}>
                                    删除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 游记管理 */}
          <TabsContent value="blogs">
            <Card>
              <CardHeader>
                <CardTitle>游记管理</CardTitle>
                <CardDescription>管理用户发布的游记内容</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>标题</TableHead>
                      <TableHead>作者</TableHead>
                      <TableHead>目的地</TableHead>
                      <TableHead>点赞数</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>发布时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blogs.map((blog) => (
                      <TableRow key={blog.id}>
                        <TableCell className="font-medium">{blog.title}</TableCell>
                        <TableCell>{blog.author}</TableCell>
                        <TableCell>{blog.destination}</TableCell>
                        <TableCell>{blog.likes}</TableCell>
                        <TableCell>
                          <Badge variant={blog.status === "published" ? "default" : "secondary"}>
                            {blog.status === "published" ? "已发布" : "草稿"}
                          </Badge>
                        </TableCell>
                        <TableCell>{blog.createdAt}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    确定要删除游记 "{blog.title}" 吗？此操作无法撤销。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction>删除</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
