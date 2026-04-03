"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Share2, Heart, Download, MapPin, Clock, Utensils, Train, Hotel, Loader2 } from "lucide-react"
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

  useEffect(() => {
    async function fetchTripData() {
      if (!tripId) {
        setError("未找到行程ID")
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const data = await tripAPI.getTrip(tripId)
        setTrip(data)
      } catch (err) {
        console.error("获取行程数据失败:", err)
        setError("获取行程数据失败，请稍后再试")
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

  const getTripDuration = (currentTrip: Trip) => {
    if (currentTrip.days.length > 0) {
      return currentTrip.days.length
    }

    const start = new Date(currentTrip.startDate)
    const end = new Date(currentTrip.endDate)
    const diffInDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, diffInDays + 1)
  }

  if (isLoading) {
    return (
      <div className="container py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg">正在加载行程数据...</p>
        </div>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-500">加载失败</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error || "未找到行程数据"}</p>
              <Button className="mt-4" asChild>
                <Link href="/trip/create">返回创建行程</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              {trip.destination} {getTripDuration(trip)} 日游
            </h1>
            <p className="text-muted-foreground">
              {formatDate(trip.startDate)} - {formatDate(trip.endDate)} · {trip.travelers}人
            </p>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">总预算</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">¥{trip.budget.toLocaleString()} / 人</p>
              <p className="text-sm text-muted-foreground">包含交通、住宿和主要活动</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">行程亮点</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {trip.highlights.map((highlight, index) => (
                  <Badge key={index}>{highlight}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">行程风格</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {trip.travelStyle === "relaxed"
                  ? "休闲放松"
                  : trip.travelStyle === "balanced"
                    ? "平衡兼顾"
                    : trip.travelStyle === "intensive"
                      ? "密集行程"
                      : trip.travelStyle === "adventure"
                        ? "探险冒险"
                        : trip.travelStyle === "cultural"
                          ? "文化体验"
                          : trip.travelStyle}
              </p>
              <p className="text-sm text-muted-foreground">
                {trip.travelStyle === "balanced"
                  ? "兼顾热门景点和当地体验"
                  : trip.travelStyle === "relaxed"
                    ? "注重休闲与放松"
                    : trip.travelStyle === "intensive"
                      ? "高效游览更多景点"
                      : trip.travelStyle === "adventure"
                        ? "注重户外和冒险体验"
                        : trip.travelStyle === "cultural"
                          ? "深入了解当地文化"
                          : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="itinerary" className="mb-8">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="itinerary">详细行程</TabsTrigger>
            <TabsTrigger value="map">地图视图</TabsTrigger>
            <TabsTrigger value="info">实用信息</TabsTrigger>
          </TabsList>
          <TabsContent value="itinerary">
            <Card>
              <CardHeader>
                <CardTitle>{trip.days.length} 天行程安排</CardTitle>
                <CardDescription>根据您的偏好生成的详细行程</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {trip.days.map((day) => (
                    <AccordionItem key={day.day} value={`day-${day.day}`}>
                      <AccordionTrigger>
                        <div className="flex items-center">
                          <span className="font-medium">第 {day.day} 天</span>
                          <Badge variant="outline" className="ml-4">
                            {day.title}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-6">
                          {day.activities.map((activity, index) => (
                            <DayActivity
                              key={index}
                              time={activity.time}
                              title={activity.title}
                              type={activity.type}
                              description={activity.description}
                            />
                          ))}
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/trip/day/${day.day}?id=${trip.id}`}>查看详情</Link>
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">修改行程</Button>
                <Button>确认行程</Button>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="map">
            <Card>
              <CardHeader>
                <CardTitle>行程地图</CardTitle>
                <CardDescription>查看您的行程在地图上的分布</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                  <p className="text-muted-foreground">地图视图将在这里显示</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>实用信息</CardTitle>
                <CardDescription>旅行前需要了解的重要信息</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">交通信息</h3>
                    <p className="text-muted-foreground mb-2">
                      {trip.destination === "东京"
                        ? "东京拥有发达的公共交通系统，建议购买 Suica 或 PASMO 卡以便于乘坐地铁和巴士。"
                        : `${trip.destination}的交通信息将在这里显示。`}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {trip.practicalInfo.transportation.map((item, index) => (
                        <Card key={index} className="bg-muted/50">
                          <CardContent className="p-4 flex items-center gap-3">
                            <Train className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground">¥{item.cost.toLocaleString()}/天</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">住宿推荐</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {trip.practicalInfo.accommodation.map((item, index) => (
                        <Card key={index} className="bg-muted/50">
                          <CardContent className="p-4 flex items-center gap-3">
                            <Hotel className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground">¥{item.cost.toLocaleString()}/晚</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">实用提示</h3>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      {trip.practicalInfo.tips.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>推荐景点</CardTitle>
            <CardDescription>根据您的偏好，您可能还会喜欢这些地方</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {trip.recommendations.map((spot, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="h-32 bg-muted flex items-center justify-center">
                    <MapPin className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium">{spot.name}</h3>
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
}: {
  time: string
  title: string
  type: string
  description: string
}) {
  const getIcon = () => {
    switch (type) {
      case "景点":
        return <MapPin className="h-5 w-5" />
      case "餐厅":
        return <Utensils className="h-5 w-5" />
      case "购物":
        return <MapPin className="h-5 w-5" />
      default:
        return <MapPin className="h-5 w-5" />
    }
  }

  return (
    <div className="flex gap-4">
      <div className="min-w-[100px] text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{time}</span>
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-full bg-primary/10 text-primary">{getIcon()}</div>
          <h4 className="font-medium">{title}</h4>
          <Badge variant="outline" className="ml-auto">
            {type}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
