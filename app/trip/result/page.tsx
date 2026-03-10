"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Share2, Heart, Download, MapPin, Clock, Utensils, Train, Hotel, Loader2, Calendar, Users, DollarSign, Compass } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { tripAPI } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"

// 定义行程类型
interface Trip {
  id: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget: number
  travelStyle: string
  highlights: string[]
  days: {
    day: number
    title: string
    activities: {
      time: string
      title: string
      type: string
      description: string
    }[]
  }[]
  recommendations: {
    name: string
    type: string
  }[]
  practicalInfo: {
    transportation: {
      name: string
      cost: number
      icon: string
    }[]
    accommodation: {
      name: string
      cost: number
      icon: string
    }[]
    tips: string[]
  }
}

export default function TripResultPage() {
  const searchParams = useSearchParams()
  const tripId = searchParams.get("id")
  const { toast } = useToast()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [activeDay, setActiveDay] = useState<number>(1)

  useEffect(() => {
    async function fetchTripData() {
      if (!tripId) {
        setError("未找到行程 ID")
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        // 尝试从 API 获取数据
        const data = await tripAPI.getTrip(tripId)
        setTrip(data)
      } catch (err) {
        console.error("获取行程数据失败:", err)
        // 如果 API 失败，显示示例数据
        setError("无法获取行程数据，显示示例行程")
        // 不设置 error，而是显示一个示例行程
        setTrip(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTripData()
  }, [tripId])

  const toggleSave = () => {
    setIsSaved(!isSaved)

    toast({
      title: isSaved ? "已取消收藏" : "已添加到收藏",
      description: isSaved ? "行程已从您的收藏中移除" : "行程已添加到您的收藏",
    })
  }

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
  }

  // 计算天数
  const calculateDays = () => {
    if (!trip) return 0
    const start = new Date(trip.startDate)
    const end = new Date(trip.endDate)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  // 获取旅行风格描述
  const getTravelStyleText = (style: string) => {
    const styles: Record<string, { title: string; desc: string }> = {
      relaxed: { title: "休闲放松", desc: "注重休闲与放松，行程轻松" },
      balanced: { title: "平衡兼顾", desc: "兼顾热门景点和当地体验" },
      intensive: { title: "密集行程", desc: "高效游览更多景点" },
      adventure: { title: "探险冒险", desc: "注重户外和冒险体验" },
      cultural: { title: "文化体验", desc: "深入了解当地文化" },
    }
    return styles[style] || { title: style, desc: "" }
  }

  if (isLoading) {
    return (
      <div className="container py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg">正在加载您的行程...</p>
        </div>
      </div>
    )
  }

  if (error && !trip) {
    return (
      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-500">加载失败</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{error}</p>
              <p className="text-sm text-muted-foreground mb-4">请确保您已经创建了行程，或者尝试重新创建。</p>
              <Button className="mt-4" asChild>
                <Link href="/trip/create">返回创建行程</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="container py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">暂无行程数据</h1>
          <p className="text-muted-foreground mb-6">请先创建一个旅行计划</p>
          <Button asChild size="lg">
            <Link href="/trip/create">创建行程</Link>
          </Button>
        </div>
      </div>
    )
  }

  const travelStyleInfo = getTravelStyleText(trip.travelStyle)

  return (
    <div className="container py-8">
      <div className="max-w-5xl mx-auto">
        {/* 头部标题 */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{trip.destination} {calculateDays()} 日游</h1>
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {trip.travelers}人同行
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  ¥{trip.budget.toLocaleString()} / 人
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleSave}>
                <Heart className={`h-4 w-4 mr-2 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
                {isSaved ? "已收藏" : "收藏"}
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                分享
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                下载
              </Button>
            </div>
          </div>
        </div>

        {/* 概览卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                总预算
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">¥{trip.budget.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">人均预算，包含交通、住宿和主要活动</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Compass className="h-5 w-5" />
                行程亮点
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {trip.highlights.slice(0, 5).map((highlight, index) => (
                  <Badge key={index} variant="secondary">{highlight}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                旅行风格
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{travelStyleInfo.title}</p>
              <p className="text-sm text-muted-foreground">{travelStyleInfo.desc}</p>
            </CardContent>
          </Card>
        </div>

        {/* 主要内容区域 */}
        <Tabs defaultValue="itinerary" className="mb-8">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="itinerary" className="text-base">📅 详细行程</TabsTrigger>
            <TabsTrigger value="map" className="text-base">🗺️ 地图视图</TabsTrigger>
            <TabsTrigger value="info" className="text-base">ℹ️ 实用信息</TabsTrigger>
          </TabsList>

          {/* 详细行程 */}
          <TabsContent value="itinerary">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{trip.days.length} 天详细行程安排</CardTitle>
                <CardDescription>根据您的偏好生成的个性化行程</CardDescription>
              </CardHeader>
              <CardContent>
                {/* 天数选择器 */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {trip.days.map((day) => (
                    <Button
                      key={day.day}
                      variant={activeDay === day.day ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveDay(day.day)}
                      className={activeDay === day.day ? "bg-primary text-primary-foreground" : ""}
                    >
                      第{day.day}天
                    </Button>
                  ))}
                </div>

                {/* 当前选中的天数详情 */}
                {trip.days.filter(d => d.day === activeDay).map((day) => (
                  <div key={day.day}>
                    <div className="flex items-center gap-3 mb-6">
                      <h3 className="text-xl font-bold">第 {day.day} 天</h3>
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {day.title}
                      </Badge>
                    </div>
                    
                    <div className="space-y-4">
                      {day.activities.map((activity, index) => (
                        <DayActivity
                          key={index}
                          time={activity.time}
                          title={activity.title}
                          type={activity.type}
                          description={activity.description}
                          index={index}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* 天数导航 */}
                <div className="flex justify-between mt-6 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setActiveDay(Math.max(1, activeDay - 1))}
                    disabled={activeDay <= 1}
                  >
                    ← 前一天
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveDay(Math.min(trip.days.length, activeDay + 1))}
                    disabled={activeDay >= trip.days.length}
                  >
                    后一天 →
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" asChild>
                  <Link href="/trip/create">修改行程</Link>
                </Button>
                <Button>确认行程</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* 地图视图 */}
          <TabsContent value="map">
            <Card>
              <CardHeader>
                <CardTitle>行程地图</CardTitle>
                <CardDescription>查看您的行程在地图上的分布</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
                  <div className="text-center">
                    <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">地图视图</p>
                    <p className="text-sm text-muted-foreground">即将支持 Google Maps / 高德地图集成</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 实用信息 */}
          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>实用信息</CardTitle>
                <CardDescription>旅行前需要了解的重要信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* 交通信息 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Train className="h-5 w-5" />
                    交通信息
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trip.practicalInfo.transportation.map((item, index) => (
                      <Card key={index} className="bg-muted/50">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Train className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">¥{item.cost.toLocaleString()}/天</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* 住宿推荐 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Hotel className="h-5 w-5" />
                    住宿推荐
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trip.practicalInfo.accommodation.map((item, index) => (
                      <Card key={index} className="bg-muted/50">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Hotel className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">¥{item.cost.toLocaleString()}/晚</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* 实用提示 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">💡 实用提示</h3>
                  <ul className="space-y-2">
                    {trip.practicalInfo.tips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span className="text-muted-foreground">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 推荐景点 */}
        <Card>
          <CardHeader>
            <CardTitle>您可能还会喜欢</CardTitle>
            <CardDescription>根据您的偏好推荐的其他景点</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {trip.recommendations.map((spot, index) => (
                <Card key={index} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <MapPin className="h-10 w-10 text-primary/50" />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{spot.name}</h3>
                    <p className="text-sm text-muted-foreground">{spot.type}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/recommendations">查看更多推荐</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

function DayActivity({
  time,
  title,
  type,
  description,
  index,
}: {
  time: string
  title: string
  type: string
  description: string
  index: number
}) {
  const getIcon = () => {
    switch (type) {
      case "景点":
        return <MapPin className="h-5 w-5" />
      case "餐厅":
        return <Utensils className="h-5 w-5" />
      case "购物":
        return <MapPin className="h-5 w-5" />
      case "娱乐":
        return <Compass className="h-5 w-5" />
      default:
        return <MapPin className="h-5 w-5" />
    }
  }

  const getTypeColor = () => {
    switch (type) {
      case "景点":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      case "餐厅":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
      case "购物":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
      case "娱乐":
        return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400"
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  return (
    <div className="flex gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="min-w-[100px] text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span className="font-medium">{time}</span>
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${getTypeColor()}`}>
            {getIcon()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-lg">{title}</h4>
              <Badge variant="outline" className={getTypeColor()}>
                {type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
