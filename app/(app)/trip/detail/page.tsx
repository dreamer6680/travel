"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Share2, Heart, Download, MapPin, Clock, Utensils, Train, Hotel, Loader2, CheckCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { tripAPI } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { TripRouteMap } from "@/components/trip-route-map"
import type { TripActivityBase } from "@/lib/types/trip"

interface Trip {
  id: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget: number
  travelStyle: string
  status: "generating" | "failed" | "draft" | "planning" | "confirmed" | "completed"
  highlights: string[]
  days: {
    day: number
    title: string
    activities: TripActivityBase[]
  }[]
  recommendations: {
    name: string
    type: string
    attractionId?: string
  }[]
  practicalInfo: {
    transportation: { name: string; cost: number; icon: string }[]
    accommodation: { name: string; cost: number; icon: string }[]
    tips: string[]
  }
  /** 系统选定酒店；hotelId 对应 PG hotel_vectors，用于地图与详情聚合 */
  selectedHotel?: { name: string; cost: number; hotelId?: string }
}

const TRAVEL_STYLE_LABELS: Record<string, { label: string; desc: string }> = {
  relaxed:   { label: "休闲放松", desc: "注重休闲与放松" },
  balanced:  { label: "平衡兼顾", desc: "兼顾热门景点和当地体验" },
  intensive: { label: "密集行程", desc: "高效游览更多景点" },
  adventure: { label: "探险冒险", desc: "注重户外和冒险体验" },
  cultural:  { label: "文化体验", desc: "深入了解当地文化" },
}

const STATUS_LABELS: Record<string, string> = {
  generating: "生成中",
  failed:     "生成失败",
  draft:      "草稿",
  planning:   "规划中",
  confirmed:  "已确认",
  completed:  "已完成",
}

const STATUS_COLORS: Record<string, string> = {
  generating: "bg-yellow-100 text-yellow-800",
  failed:     "bg-red-100 text-red-800",
  draft:      "bg-gray-100 text-gray-800",
  planning:   "bg-blue-100 text-blue-800",
  confirmed:  "bg-green-100 text-green-800",
  completed:  "bg-purple-100 text-purple-800",
}

export default function TripDetailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tripId = searchParams.get("id")
  const { toast } = useToast()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [locationData, setLocationData] = useState<{
    days: any[]
    allLocations: any[]
  } | null>(null)
  const [isLoadingMap, setIsLoadingMap] = useState(false)

  useEffect(() => {
    if (!tripId) {
      setError("未找到行程ID")
      setIsLoading(false)
      return
    }

    async function load() {
      try {
        setIsLoading(true)
        const [tripData, favData] = await Promise.all([
          tripAPI.getTrip(tripId!),
          tripAPI.checkFavorite(tripId!).catch(() => ({ favorited: false })),
        ])
        setTrip(tripData)
        setIsSaved(favData.favorited)

        // 异步获取地图位置数据（不阻塞页面渲染）
        if (tripData?.days?.length > 0) {
          setIsLoadingMap(true)
          fetch("/api/trips/locations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trip: tripData }),
          })
            .then((r) => r.json())
            .then((locData) => setLocationData({ days: locData.days, allLocations: locData.allLocations }))
            .catch((e) => console.warn("地图坐标获取失败:", e))
            .finally(() => setIsLoadingMap(false))
        }
      } catch (err) {
        console.error("获取行程数据失败:", err)
        setError("获取行程数据失败，请稍后再试")
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [tripId])

  const handleToggleFavorite = async () => {
    if (!trip || isSaving) return
    setIsSaving(true)
    try {
      const result = await tripAPI.toggleFavorite(trip.id)
      setIsSaved(result.favorited)
      toast({
        title: result.favorited ? "已添加到收藏" : "已取消收藏",
        description: result.favorited ? "行程已添加到您的收藏" : "行程已从收藏中移除",
      })
    } catch {
      toast({ title: "操作失败", description: "请稍后再试", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmTrip = async () => {
    if (!trip || isConfirming) return
    setIsConfirming(true)
    try {
      const updated = await tripAPI.confirmTrip(trip)
      setTrip({ ...trip, status: "confirmed" })
      toast({ title: "行程已确认 ✓", description: "您的行程已成功确认" })
    } catch {
      toast({ title: "确认失败", description: "请稍后再试", variant: "destructive" })
    } finally {
      setIsConfirming(false)
    }
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })

  if (isLoading) {
    return (
      <div className="w-full py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg">正在加载行程数据...</p>
        </div>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="w-full py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-500">加载失败</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error || "未找到行程数据"}</p>
              <Button className="mt-4" asChild>
                <Link href="/trips">返回我的行程</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const styleInfo = TRAVEL_STYLE_LABELS[trip.travelStyle] ?? { label: trip.travelStyle, desc: "" }
  const tripDays = Math.ceil(
    (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  const isDraft = trip.status === "draft" || trip.status === "planning"
  const isConfirmed = trip.status === "confirmed" || trip.status === "completed"

  return (
    <div className="w-full py-8">
      <div className="max-w-4xl mx-auto">
        {/* 返回按钮 */}
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/trips">
            <ArrowLeft className="h-4 w-4 mr-1" />
            我的行程
          </Link>
        </Button>

        {/* 页头 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold">
                {trip.destination} {tripDays} 日游
              </h1>
              <Badge className={STATUS_COLORS[trip.status]}>
                {STATUS_LABELS[trip.status] ?? trip.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {formatDate(trip.startDate)} - {formatDate(trip.endDate)} · {trip.travelers} 人
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleToggleFavorite} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Heart className={`h-4 w-4 mr-2 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
              )}
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

        {/* 概览卡片 */}
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
                {trip.highlights.map((h, i) => (
                  <Badge key={i}>{h}</Badge>
                ))}
                {trip.highlights.length === 0 && (
                  <p className="text-sm text-muted-foreground">暂无亮点信息</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">行程风格</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{styleInfo.label}</p>
              <p className="text-sm text-muted-foreground">{styleInfo.desc}</p>
            </CardContent>
          </Card>
        </div>

        {/* 地图视图（独立区块，预算卡片下方） */}
        <div className="mb-8">
          {isLoadingMap ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">正在获取地点坐标...</p>
                </div>
              </CardContent>
            </Card>
          ) : locationData ? (
            <TripRouteMap
              destination={trip.destination}
              days={locationData.days}
              allLocations={locationData.allLocations}
              mapHeight="500px"
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">暂无地图数据</p>
                  <p className="text-xs mt-1">请确认 Python Agent 服务正在运行</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 详细行程 Tabs */}
        <Tabs defaultValue="itinerary" className="mb-8">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="itinerary">详细行程</TabsTrigger>
            <TabsTrigger value="info">实用信息</TabsTrigger>
          </TabsList>

          <TabsContent value="itinerary">
            <Card>
              <CardHeader>
                <CardTitle>{trip.days.length} 天行程安排</CardTitle>
                <CardDescription>根据您的偏好生成的详细行程</CardDescription>
              </CardHeader>
              <CardContent>
                {trip.days.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">行程详情尚未生成</p>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {trip.days.map((day) => (
                      <AccordionItem key={day.day} value={`day-${day.day}`}>
                        <AccordionTrigger>
                          <div className="flex items-center">
                            <span className="font-medium">第 {day.day} 天</span>
                            <Badge variant="outline" className="ml-4">{day.title}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-6">
                            {day.activities.map((activity, index) => (
                              <DayActivity key={index} {...activity} />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" asChild>
                  <Link href="/trips">返回列表</Link>
                </Button>
                {isDraft && (
                  <Button onClick={handleConfirmTrip} disabled={isConfirming}>
                    {isConfirming ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        确认中...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        确认行程
                      </>
                    )}
                  </Button>
                )}
                {isConfirmed && (
                  <Badge className="bg-green-100 text-green-800 px-4 py-2 text-sm">
                    <CheckCircle className="h-4 w-4 mr-1 inline" />
                    行程已确认
                  </Badge>
                )}
              </CardFooter>
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
                    <h3 className="text-lg font-medium mb-3">交通信息</h3>
                    {trip.practicalInfo.transportation.length === 0 ? (
                      <p className="text-muted-foreground text-sm">暂无交通信息</p>
                    ) : (
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
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-3">住宿推荐</h3>
                    {trip.selectedHotel && (
                      <div className="mb-3 p-3 border rounded-md bg-primary/5">
                        <p className="text-sm font-medium text-primary mb-1">AI 推荐住宿</p>
                        <div className="flex items-center gap-2">
                          <Hotel className="h-4 w-4 text-primary" />
                          <span className="font-medium">{trip.selectedHotel.name}</span>
                          <span className="text-sm text-muted-foreground ml-auto">
                            ¥{trip.selectedHotel.cost.toLocaleString()}/晚
                          </span>
                        </div>
                      </div>
                    )}
                    {trip.practicalInfo.accommodation.length === 0 ? (
                      <p className="text-muted-foreground text-sm">暂无住宿信息</p>
                    ) : (
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
                    )}
                  </div>

                  {trip.practicalInfo.tips.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium mb-3">实用提示</h3>
                      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                        {trip.practicalInfo.tips.map((tip, index) => (
                          <li key={index}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 推荐景点 */}
        {trip.recommendations.length > 0 && (
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
          </Card>
        )}
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
  const icon = type === "餐厅" ? <Utensils className="h-5 w-5" /> : <MapPin className="h-5 w-5" />

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
          <div className="p-1.5 rounded-full bg-primary/10 text-primary">{icon}</div>
          <h4 className="font-medium">{title}</h4>
          <Badge variant="outline" className="ml-auto">{type}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
