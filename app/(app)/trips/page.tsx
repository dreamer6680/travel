"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Search,
  Plus,
  MapPin,
  Calendar,
  Users,
  MoreVertical,
  Edit,
  Share2,
  Trash2,
  Eye,
  Loader2,
  Filter,
} from "lucide-react"
import Link from "next/link"
import { tripAPI } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useUserStore } from "@/lib/store/user-store"

// 定义行程类型
interface Trip {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget: number
  status: "generating" | "failed" | "draft" | "planning" | "confirmed" | "completed"
  highlights: string[]
  createdAt: string
  updatedAt: string
}

export default function TripsPage() {
  const { toast } = useToast()
  const { user, isAuthenticated } = useUserStore()
  const [trips, setTrips] = useState<Trip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("updatedAt")

  // 获取用户行程，如果有「生成中」的行程则 10s 轮询一次
  useEffect(() => {
    let pollTimer: ReturnType<typeof setTimeout> | null = null

    async function fetchTrips(silent = false) {
      if (!isAuthenticated) return
      try {
        if (!silent) setIsLoading(true)
        const data = await tripAPI.getUserTrips()
        setTrips(data)

        // 有「生成中」的行程就继续轮询
        if (data.some((t: Trip) => t.status === "generating")) {
          pollTimer = setTimeout(() => fetchTrips(true), 10_000)
        }
      } catch (error) {
        console.error("获取行程失败:", error)
        if (!silent) {
          toast({ title: "获取行程失败", description: "请稍后再试", variant: "destructive" })
        }
      } finally {
        if (!silent) setIsLoading(false)
      }
    }

    fetchTrips()
    return () => { if (pollTimer) clearTimeout(pollTimer) }
  }, [toast, isAuthenticated])

  // 删除行程
  const handleDeleteTrip = async (tripId: string) => {
    try {
      await tripAPI.deleteTrip(tripId)
      setTrips(trips.filter((trip) => trip.id !== tripId))
      toast({
        title: "行程已删除",
        description: "行程已成功删除",
      })
    } catch (error) {
      console.error("删除行程失败:", error)
      toast({
        title: "删除失败",
        description: "请稍后再试",
        variant: "destructive",
      })
    }
  }

  // 筛选和排序行程
  const filteredAndSortedTrips = trips
    .filter((trip) => {
      const matchesSearch =
        (trip.title ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trip.destination ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || trip.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "startDate":
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        case "budget":
          return b.budget - a.budget
        case "createdAt":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
    })

  // 按状态分组行程
  const tripsByStatus = {
    generating: filteredAndSortedTrips.filter((trip) => trip.status === "generating"),
    draft: filteredAndSortedTrips.filter((trip) => trip.status === "draft"),
    planning: filteredAndSortedTrips.filter((trip) => trip.status === "planning"),
    confirmed: filteredAndSortedTrips.filter((trip) => trip.status === "confirmed"),
    completed: filteredAndSortedTrips.filter((trip) => trip.status === "completed"),
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "generating": return "生成中"
      case "failed":     return "生成失败"
      case "draft":      return "草稿"
      case "planning":   return "规划中"
      case "confirmed":  return "已确认"
      case "completed":  return "已完成"
      default:           return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "generating": return "bg-yellow-100 text-yellow-800"
      case "failed":     return "bg-red-100 text-red-800"
      case "draft":      return "bg-gray-100 text-gray-800"
      case "planning":   return "bg-blue-100 text-blue-800"
      case "confirmed":  return "bg-green-100 text-green-800"
      case "completed":  return "bg-purple-100 text-purple-800"
      default:           return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
  }

  if (isLoading) {
    return (
      <div className="w-full py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg">正在加载您的行程...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-8">
      <div className="max-w-6xl mx-auto">
        {/* 页面头部 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">我的行程</h1>
            <p className="text-muted-foreground">管理您的所有旅行计划</p>
          </div>
          <Button asChild>
            <Link href="/trip/create">
              <Plus className="h-4 w-4 mr-2" />
              创建新行程
            </Link>
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索行程或目的地..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="planning">规划中</SelectItem>
                <SelectItem value="confirmed">已确认</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt">最近更新</SelectItem>
                <SelectItem value="startDate">出发日期</SelectItem>
                <SelectItem value="createdAt">创建时间</SelectItem>
                <SelectItem value="budget">预算</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 行程统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{tripsByStatus.draft.length}</div>
              <div className="text-sm text-muted-foreground">草稿</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{tripsByStatus.planning.length}</div>
              <div className="text-sm text-muted-foreground">规划中</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{tripsByStatus.confirmed.length}</div>
              <div className="text-sm text-muted-foreground">已确认</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{tripsByStatus.completed.length}</div>
              <div className="text-sm text-muted-foreground">已完成</div>
            </CardContent>
          </Card>
        </div>

        {/* 行程列表 */}
        <Tabs defaultValue="all" className="mb-8">
          <TabsList className="grid grid-cols-5 mb-6">
            <TabsTrigger value="all">全部 ({filteredAndSortedTrips.length})</TabsTrigger>
            <TabsTrigger value="draft">草稿 ({tripsByStatus.draft.length})</TabsTrigger>
            <TabsTrigger value="planning">规划中 ({tripsByStatus.planning.length})</TabsTrigger>
            <TabsTrigger value="confirmed">已确认 ({tripsByStatus.confirmed.length})</TabsTrigger>
            <TabsTrigger value="completed">已完成 ({tripsByStatus.completed.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <TripGrid trips={filteredAndSortedTrips} onDeleteTrip={handleDeleteTrip} />
          </TabsContent>
          <TabsContent value="draft">
            <TripGrid trips={tripsByStatus.draft} onDeleteTrip={handleDeleteTrip} />
          </TabsContent>
          <TabsContent value="planning">
            <TripGrid trips={tripsByStatus.planning} onDeleteTrip={handleDeleteTrip} />
          </TabsContent>
          <TabsContent value="confirmed">
            <TripGrid trips={tripsByStatus.confirmed} onDeleteTrip={handleDeleteTrip} />
          </TabsContent>
          <TabsContent value="completed">
            <TripGrid trips={tripsByStatus.completed} onDeleteTrip={handleDeleteTrip} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function TripGrid({ trips, onDeleteTrip }: { trips: Trip[]; onDeleteTrip: (tripId: string) => void }) {
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "generating": return "生成中"
      case "failed":     return "生成失败"
      case "draft":      return "草稿"
      case "planning":   return "规划中"
      case "confirmed":  return "已确认"
      case "completed":  return "已完成"
      default:           return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "generating": return "bg-yellow-100 text-yellow-800"
      case "failed":     return "bg-red-100 text-red-800"
      case "draft":      return "bg-gray-100 text-gray-800"
      case "planning":   return "bg-blue-100 text-blue-800"
      case "confirmed":  return "bg-green-100 text-green-800"
      case "completed":  return "bg-purple-100 text-purple-800"
      default:           return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
  }

  if (trips.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">暂无行程</h3>
        <p className="text-muted-foreground mb-4">开始创建您的第一个旅行计划吧！</p>
        <Button asChild>
          <Link href="/trip/create">
            <Plus className="h-4 w-4 mr-2" />
            创建行程
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {trips.map((trip) => (
        <Card key={trip.id} className="overflow-hidden hover:shadow-lg transition-shadow">
          <div className="h-48 bg-muted flex items-center justify-center">
            {trip.status === "generating" ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-sm">AI 规划中...</span>
              </div>
            ) : (
              <MapPin className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{trip.title}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {trip.destination}
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/trip/detail?id=${trip.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      查看详情
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/trip/edit/${trip.id}`}>
                      <Edit className="h-4 w-4 mr-2" />
                      编辑行程
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share2 className="h-4 w-4 mr-2" />
                    分享行程
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除行程
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                          您确定要删除行程"{trip.title}"吗？此操作无法撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDeleteTrip(trip.id)}>删除</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className={getStatusColor(trip.status)}>{getStatusLabel(trip.status)}</Badge>
                <span className="text-sm font-medium">¥{trip.budget.toLocaleString()}</span>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{trip.travelers}人</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {trip.highlights.slice(0, 3).map((highlight, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {highlight}
                  </Badge>
                ))}
                {trip.highlights.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{trip.highlights.length - 3}
                  </Badge>
                )}
              </div>

              <Button className="w-full" variant="outline" asChild>
                <Link href={`/trip/detail?id=${trip.id}`}>查看详情</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
