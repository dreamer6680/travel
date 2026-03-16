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
import { useRouter } from "next/navigation"
import { TripRouteMap } from "@/components/trip-route-map"
import { enhanceTripWithLocations, TripWithLocations } from "@/lib/services/trip-location-enhancer"

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
  /** 用户选择的酒店（在结果页从推荐中选定后写入） */
  selectedAccommodation?: { name: string; cost: number }
  /** 系统选定的酒店（行程以该酒店为每日起止，含公交规划） */
  selectedHotel?: { name: string; cost: number; latitude?: number; longitude?: number }
}

export default function TripResultPage() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [tripWithLocations, setTripWithLocations] = useState<TripWithLocations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const router = useRouter()

  /** 用户从推荐列表中选定的酒店 */
  const selectedAccommodation = trip?.selectedAccommodation ?? null

  const handleSelectAccommodation = (item: { name: string; cost: number }) => {
    if (!trip) return
    const updated = { ...trip, selectedAccommodation: item }
    setTrip(updated)
    try {
      localStorage.setItem("trip", JSON.stringify(updated))
    } catch (_) {}
    toast({
      title: "已选择住宿",
      description: `${item.name} · ¥${item.cost.toLocaleString()}/晚`,
    })
  }

  const handleClearAccommodation = () => {
    if (!trip) return
    const { selectedAccommodation: _, ...rest } = trip
    const updated = { ...rest, selectedAccommodation: undefined }
    setTrip(updated)
    try {
      localStorage.setItem("trip", JSON.stringify(updated))
    } catch (_) {}
    toast({ title: "已取消选择", description: "可重新从推荐列表中选择酒店" })
  }

  useEffect(() => {
    async function fetchTripData() {
      try {
        setIsLoading(true)
        const data = JSON.parse(localStorage.getItem("trip") || "{}")
        setTrip(data)

        // 如果有行程数据，获取地点信息
        if (data && data.days) {
          setIsLoadingLocations(true)
          try {
            // 调用 API 获取地点坐标
            const response = await fetch("/api/trips/locations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ trip: data }),
            })

            if (response.ok) {
              const tripWithLocations = await response.json()
              setTripWithLocations(tripWithLocations)
            } else {
              console.warn("获取地点信息失败，将显示不带地图的行程")
            }
          } catch (err) {
            console.error("获取地点信息失败:", err)
          } finally {
            setIsLoadingLocations(false)
          }
        }
      } catch (err) {
        console.error("获取行程数据失败:", err)
        setError("获取行程数据失败，请稍后再试")
      } finally {
        setIsLoading(false)
      }
    }

    fetchTripData()
  }, [])

  const handleConfirmTrip = () => {
    tripAPI.confirmTrip(trip).then((res) => {
      if (res.status === 200) {
        toast({
          title: "行程确认成功",
          description: "行程已确认，请等待审核",
        })
        router.push("/trip")
      } else {
        toast({
          title: "行程确认失败",
          description: "请稍后再试",
        })
      }
    })
  }

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
                <Link href="/trip/create">返回创建行程</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  console.log("tripWithLocations", tripWithLocations)

  return (
    <div className="w-full py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              {trip.destination}{" "}
              {Math.ceil(
                (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24),
              )}{" "}
              日游
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
                <Button onClick={handleConfirmTrip}>确认行程</Button>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="map">
            {isLoadingLocations ? (
              <Card>
                <CardHeader>
                  <CardTitle>行程地图</CardTitle>
                  <CardDescription>正在加载地点信息...</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-muted-foreground">正在获取地点坐标...</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : tripWithLocations && tripWithLocations.allLocations.length > 0 ? (
              <TripRouteMap
                destination={tripWithLocations.destination}
                days={tripWithLocations.days}
                allLocations={tripWithLocations.allLocations.map((loc) => ({
                  name: loc.name,
                  coordinate: loc.coordinate,
                }))}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>行程地图</CardTitle>
                  <CardDescription>查看您的行程在地图上的分布</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">暂无地点信息</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        无法获取活动地点的坐标信息
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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
                    <h3 className="text-lg font-medium mb-2">住宿</h3>
                    {trip.selectedHotel ? (
                      <>
                        <p className="text-sm text-muted-foreground mb-3">
                          已为您选定一家酒店，每日行程从该酒店出发并返回，含公共交通规划
                        </p>
                        <Card className="border-primary bg-primary/5">
                          <CardContent className="p-4 flex items-center gap-3">
                            <Hotel className="h-5 w-5 text-primary shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{trip.selectedHotel.name}</p>
                              <p className="text-sm text-muted-foreground">
                                ¥{trip.selectedHotel.cost.toLocaleString()}/晚
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <>
                        {selectedAccommodation && (
                          <Card className="mb-4 border-primary bg-primary/5">
                            <CardContent className="p-4 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <Hotel className="h-5 w-5 text-primary shrink-0" />
                                <div>
                                  <p className="font-medium">您选择的住宿</p>
                                  <p className="text-sm text-muted-foreground">
                                    {selectedAccommodation.name} · ¥{selectedAccommodation.cost.toLocaleString()}/晚
                                  </p>
                                </div>
                              </div>
                              <Button type="button" variant="ghost" size="sm" onClick={handleClearAccommodation}>
                                重选
                              </Button>
                            </CardContent>
                          </Card>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {trip.practicalInfo.accommodation.map((item, index) => {
                            const isSelected =
                              selectedAccommodation?.name === item.name && selectedAccommodation?.cost === item.cost
                            return (
                              <Card
                                key={index}
                                className={`bg-muted/50 cursor-pointer transition-colors hover:bg-muted/70 ${
                                  isSelected ? "ring-2 ring-primary" : ""
                                }`}
                                onClick={() => handleSelectAccommodation(item)}
                              >
                                <CardContent className="p-4 flex items-center gap-3">
                                  <Hotel className="h-5 w-5 text-primary shrink-0" />
                                  <div className="min-w-0 flex-1 flex items-center gap-2 text-sm">
                                    <span className="font-medium truncate">{item.name}</span>
                                    <span className="text-muted-foreground shrink-0">¥{item.cost.toLocaleString()}/晚</span>
                                  </div>
                                  {isSelected && (
                                    <Badge variant="default" className="shrink-0">
                                      已选
                                    </Badge>
                                  )}
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      </>
                    )}
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
