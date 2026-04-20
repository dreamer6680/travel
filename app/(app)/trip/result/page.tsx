"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Share2, Heart, Download, MapPin, Train, Hotel, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { tripAPI } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { TripRouteMap } from "@/components/trip-route-map"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatTripActivityType, type TripActivityBase } from "@/lib/types/trip"

interface TripWithLocations {
  destination: string
  days: Array<{
    day: number
    title: string
    activities: TripActivityBase[]
  }>
  allLocations: Array<{ name: string; coordinate: { lat: number; lng: number } }>
}

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
    activities: TripActivityBase[]
  }[]
  recommendations: {
    name: string
    type: string
    attractionId?: string
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
  estimatedCost?: number
  /** 系统选定的酒店（行程以该酒店为每日起止，含公交规划） */
  selectedHotel?: {
    name: string
    cost: number
    totalCost?: number
    priceDisplay?: string
    rating?: number
    address?: string
    positionDesc?: string
    imageUrl?: string
    latitude?: number
    longitude?: number
    hotelId?: string
  }
}

const TRAVEL_STYLE_META: Record<string, { label: string; description: string }> = {
  relaxed: { label: "休闲放松", description: "注重休闲与放松" },
  balanced: { label: "平衡兼顾", description: "兼顾热门景点和当地体验" },
  intensive: { label: "密集行程", description: "高效游览更多景点" },
  adventure: { label: "探险冒险", description: "注重户外和冒险体验" },
  cultural: { label: "文化体验", description: "深入了解当地文化" },
}

function getTravelStyleMeta(style: string) {
  return TRAVEL_STYLE_META[style] ?? { label: style, description: "" }
}

function formatActivityCoord(c?: { lat: number; lng: number }): string {
  if (!c || typeof c.lat !== "number" || typeof c.lng !== "number") return "—"
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`
}

function formatRefId(ref?: TripActivityBase["ref"]): string {
  if (!ref) return "—"
  if (ref.attractionId) return ref.attractionId
  if (ref.restaurantId) return ref.restaurantId
  if (ref.hotelId) return ref.hotelId
  return "—"
}

function safeParseTrip(raw: string | null): Trip | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.days)) {
      return parsed as Trip
    }
    return null
  } catch (error) {
    console.error("解析本地行程数据失败:", error)
    return null
  }
}

export default function TripResultPage() {
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
        const data = safeParseTrip(localStorage.getItem("trip"))
        setTrip(data)

        // 如果有行程数据，获取地点信息
        if (data?.days) {
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
        } else {
          setError("未找到行程数据")
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
    if (!trip) return
    tripAPI
      .confirmTrip(trip)
      .then((res) => {
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
      .catch((err) => {
        console.error("确认行程失败:", err)
        toast({
          title: "行程确认失败",
          description: "网络异常，请稍后重试",
        })
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

  const itineraryDays =
    tripWithLocations?.days && tripWithLocations.days.length > 0 ? tripWithLocations.days : trip.days

  const hasMapCoords =
    !!tripWithLocations?.days?.some((d) =>
      (d.activities ?? []).some(
        (a) =>
          a.coordinate &&
          typeof (a.coordinate as { lat?: number }).lat === "number" &&
          typeof (a.coordinate as { lng?: number }).lng === "number",
      ),
    )

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
              <CardTitle className="text-lg">预算概览</CardTitle>
            </CardHeader>
            <CardContent>
              {trip.estimatedCost ? (
                <>
                  <p className="text-2xl font-bold">¥{trip.estimatedCost.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">
                    预估花费 / 上限 ¥{trip.budget.toLocaleString()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold">¥{trip.budget.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">总预算 / 人</p>
                </>
              )}
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
              <p className="font-medium">{getTravelStyleMeta(trip.travelStyle).label}</p>
              <p className="text-sm text-muted-foreground">{getTravelStyleMeta(trip.travelStyle).description}</p>
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
                <CardTitle>{itineraryDays.length} 天行程安排</CardTitle>
                <CardDescription>根据您的偏好生成的详细行程</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {itineraryDays.map((day) => (
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
                        <p className="text-xs text-muted-foreground mb-3">
                          坐标为 GCJ-02（与高德一致），由 PG 关联 ref 与路径规划接口补全。
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[120px] whitespace-nowrap">时间</TableHead>
                              <TableHead className="min-w-[140px]">地点</TableHead>
                              <TableHead className="w-[100px]">类型</TableHead>
                              <TableHead className="w-[100px]">POI ID</TableHead>
                              <TableHead className="min-w-[150px] whitespace-nowrap">经纬度</TableHead>
                              <TableHead className="min-w-[200px]">说明</TableHead>
                              <TableHead className="w-[72px] text-right">人均</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {day.activities.map((activity, index) => (
                              <TableRow key={index}>
                                <TableCell className="align-top text-muted-foreground whitespace-nowrap">
                                  {activity.time}
                                </TableCell>
                                <TableCell className="align-top font-medium">
                                  {activity.title ?? "—"}
                                  {activity.location ? (
                                    <span className="block text-xs font-normal text-muted-foreground mt-1">
                                      {activity.location}
                                    </span>
                                  ) : null}
                                </TableCell>
                                <TableCell className="align-top text-xs">
                                  {formatTripActivityType(activity.type)}
                                </TableCell>
                                <TableCell className="align-top font-mono text-xs text-muted-foreground">
                                  {formatRefId(activity.ref)}
                                </TableCell>
                                <TableCell className="align-top font-mono text-xs">
                                  {formatActivityCoord(activity.coordinate)}
                                </TableCell>
                                <TableCell className="align-top text-muted-foreground text-xs max-w-[280px]">
                                  {activity.description ?? "—"}
                                </TableCell>
                                <TableCell className="align-top text-right whitespace-nowrap">
                                  {activity.priceYuan != null ? `¥${activity.priceYuan}` : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
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
            ) : tripWithLocations && hasMapCoords ? (
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
                      <p className="text-muted-foreground">暂无坐标数据</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        请确认 Python Agent 已运行且 PG 中 POI 含经纬度
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{trip.selectedHotel.name}</p>
                                {trip.selectedHotel.rating && (
                                  <Badge variant="secondary" className="text-xs">
                                    ★ {trip.selectedHotel.rating}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {trip.selectedHotel.priceDisplay || `¥${trip.selectedHotel.cost.toLocaleString()}/晚`}
                                {trip.selectedHotel.totalCost && (
                                  <span className="ml-2 text-xs">
                                    · 共 ¥{trip.selectedHotel.totalCost.toLocaleString()}
                                  </span>
                                )}
                              </p>
                              {trip.selectedHotel.positionDesc && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {trip.selectedHotel.positionDesc}
                                </p>
                              )}
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
