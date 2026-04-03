"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { tripAPI } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Clock,
  Download,
  GripVertical,
  Heart,
  Hotel,
  Landmark,
  Loader2,
  MapPin,
  RotateCcw,
  Route,
  Save,
  Share2,
  ShoppingBag,
  Sparkles,
  Train,
  TreePine,
  Utensils,
} from "lucide-react"

interface TripActivity {
  time: string
  title: string
  type: string
  description: string
}

interface TripDay {
  day: number
  title: string
  activities: TripActivity[]
}

interface Trip {
  id: string
  title?: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget: number
  travelStyle: string
  highlights: string[]
  days: TripDay[]
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

interface DragPayload {
  dayIndex: number
  activityIndex: number
}

interface RouteStop {
  id: string
  dayIndex: number
  dayNumber: number
  activityIndex: number
  title: string
  time: string
  type: string
  x: number
  y: number
  color: string
}

const DAY_THEMES = [
  {
    panel: "border-sky-200/70 bg-gradient-to-br from-sky-500/12 via-background to-cyan-500/14 dark:border-sky-500/20",
    badge: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    marker: "bg-sky-500 text-white",
    path: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.26)",
  },
  {
    panel: "border-emerald-200/70 bg-gradient-to-br from-emerald-500/12 via-background to-lime-500/12 dark:border-emerald-500/20",
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    marker: "bg-emerald-500 text-white",
    path: "#10b981",
    glow: "rgba(16, 185, 129, 0.26)",
  },
  {
    panel: "border-amber-200/70 bg-gradient-to-br from-amber-500/14 via-background to-orange-500/12 dark:border-amber-500/20",
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    marker: "bg-amber-500 text-white",
    path: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.26)",
  },
  {
    panel: "border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-500/12 via-background to-rose-500/12 dark:border-fuchsia-500/20",
    badge: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
    marker: "bg-fuchsia-500 text-white",
    path: "#d946ef",
    glow: "rgba(217, 70, 239, 0.24)",
  },
] as const

function getDayTheme(index: number) {
  return DAY_THEMES[index % DAY_THEMES.length]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getTripDuration(currentTrip: Trip) {
  if (currentTrip.days.length > 0) {
    return currentTrip.days.length
  }

  const start = new Date(currentTrip.startDate)
  const end = new Date(currentTrip.endDate)
  const diffInDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diffInDays + 1)
}

function deriveDayTitle(activities: TripActivity[]) {
  const titles = activities
    .map((activity) => activity.title.trim())
    .filter(Boolean)
    .slice(0, 2)

  return titles.length > 0 ? titles.join(" · ") : "自由探索"
}

function normalizePlannerDays(days: TripDay[]) {
  return days.map((day, dayIndex) => ({
    day: dayIndex + 1,
    title: day.title?.trim() || deriveDayTitle(day.activities),
    activities: day.activities.map((activity, activityIndex) => ({
      time: activity.time?.trim() || `时段 ${activityIndex + 1}`,
      title: activity.title?.trim() || `行程点 ${activityIndex + 1}`,
      type: activity.type?.trim() || "景点",
      description: activity.description?.trim() || "待补充活动描述。",
    })),
  }))
}

function buildHighlightsFromDays(days: TripDay[], fallbackHighlights: string[]) {
  const highlights = Array.from(new Set(days.flatMap((day) => day.activities.map((activity) => activity.title)))).slice(
    0,
    5,
  )

  return highlights.length > 0 ? highlights : fallbackHighlights
}

function movePlannerActivity(
  currentDays: TripDay[],
  payload: DragPayload,
  targetDayIndex: number,
  targetActivityIndex: number | null,
) {
  const nextDays = currentDays.map((day) => ({
    ...day,
    activities: [...day.activities],
  }))

  const sourceActivities = nextDays[payload.dayIndex]?.activities

  if (!sourceActivities) {
    return currentDays
  }

  const [movedActivity] = sourceActivities.splice(payload.activityIndex, 1)

  if (!movedActivity) {
    return currentDays
  }

  const targetActivities = nextDays[targetDayIndex]?.activities

  if (!targetActivities) {
    return currentDays
  }

  let insertIndex = targetActivityIndex ?? targetActivities.length

  if (
    payload.dayIndex === targetDayIndex &&
    targetActivityIndex !== null &&
    payload.activityIndex < targetActivityIndex
  ) {
    insertIndex = targetActivityIndex - 1
  }

  if (payload.dayIndex === targetDayIndex && payload.activityIndex === insertIndex) {
    return currentDays
  }

  targetActivities.splice(insertIndex, 0, movedActivity)
  return normalizePlannerDays(nextDays)
}

function buildRouteStops(days: TripDay[]): RouteStop[] {
  const clusterOffsets = [
    { x: -56, y: -42 },
    { x: 52, y: -8 },
    { x: 24, y: 58 },
    { x: -46, y: 96 },
    { x: 56, y: 128 },
  ]
  const lastDayIndex = Math.max(days.length - 1, 1)

  return days.flatMap((day, dayIndex) => {
    const anchorX = days.length === 1 ? 500 : 130 + (740 / lastDayIndex) * dayIndex
    const anchorY = 148 + (dayIndex % 2) * 168
    const theme = getDayTheme(dayIndex)

    return day.activities.map((activity, activityIndex) => {
      const offset = clusterOffsets[activityIndex % clusterOffsets.length]

      return {
        id: `${day.day}-${activityIndex}-${activity.title}`,
        dayIndex,
        dayNumber: day.day,
        activityIndex,
        title: activity.title,
        time: activity.time,
        type: activity.type,
        x: clamp(anchorX + offset.x, 82, 918),
        y: clamp(anchorY + offset.y, 86, 474),
        color: theme.path,
      }
    })
  })
}

function buildRoutePath(stops: RouteStop[]) {
  if (stops.length === 0) {
    return ""
  }

  let path = `M ${stops[0].x} ${stops[0].y}`

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]
    const current = stops[index]
    const deltaX = current.x - previous.x

    path += ` C ${previous.x + deltaX * 0.42} ${previous.y}, ${previous.x + deltaX * 0.58} ${current.y}, ${current.x} ${current.y}`
  }

  return path
}

function formatDisplayDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
}

function getTravelStyleMeta(travelStyle: string) {
  switch (travelStyle) {
    case "relaxed":
      return {
        label: "休闲放松",
        description: "安排更松弛，留出更多停留和自由探索时间。",
      }
    case "intensive":
      return {
        label: "密集行程",
        description: "景点串联更紧凑，适合想高效打卡更多地点的路线。",
      }
    case "adventure":
      return {
        label: "探险冒险",
        description: "强调户外体验和节奏变化，路线更有起伏感。",
      }
    case "cultural":
      return {
        label: "文化体验",
        description: "聚焦在历史地标、街区故事和当地生活质感。",
      }
    default:
      return {
        label: "平衡兼顾",
        description: "在经典景点、休息节奏和本地体验之间取得平衡。",
      }
  }
}

function getActivityMeta(type: string) {
  switch (type) {
    case "餐厅":
      return {
        icon: Utensils,
        badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        halo: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
      }
    case "购物":
      return {
        icon: ShoppingBag,
        badge: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
        halo: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300",
      }
    case "文化景点":
    case "博物馆":
      return {
        icon: Landmark,
        badge: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
        halo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
      }
    case "自然景观":
      return {
        icon: TreePine,
        badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        halo: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
      }
    default:
      return {
        icon: MapPin,
        badge: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        halo: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
      }
  }
}

export default function TripResultPage() {
  const searchParams = useSearchParams()
  const tripId = searchParams.get("id")
  const { toast } = useToast()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [plannerDays, setPlannerDays] = useState<TripDay[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingLayout, setIsSavingLayout] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
  const [dropTarget, setDropTarget] = useState<{ dayIndex: number; activityIndex: number | null } | null>(null)

  useEffect(() => {
    async function fetchTripData() {
      if (!tripId) {
        setError("未找到行程ID")
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const data = await tripAPI.getTrip(tripId)
        setTrip(data)
        setPlannerDays(normalizePlannerDays(data.days))
      } catch (fetchError) {
        console.error("获取行程数据失败:", fetchError)
        setError("获取行程数据失败，请稍后再试")
      } finally {
        setIsLoading(false)
      }
    }

    fetchTripData()
  }, [tripId])

  const normalizedDays = normalizePlannerDays(plannerDays)
  const routeStops = buildRouteStops(normalizedDays)
  const travelStyleMeta = trip ? getTravelStyleMeta(trip.travelStyle) : null
  const totalActivities = normalizedDays.reduce((total, day) => total + day.activities.length, 0)
  const totalTransitSegments = Math.max(routeStops.length - 1, 0)
  const hasPlannerChanges = trip ? JSON.stringify(normalizedDays) !== JSON.stringify(normalizePlannerDays(trip.days)) : false

  const toggleSave = () => {
    setIsSaved((currentValue) => {
      const nextValue = !currentValue

      toast({
        title: nextValue ? "已添加到收藏" : "已取消收藏",
        description: nextValue ? "这个路线方案已加入您的收藏夹" : "这个路线方案已从收藏夹中移除",
      })

      return nextValue
    })
  }

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, dayIndex: number, activityIndex: number) => {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", `${dayIndex}:${activityIndex}`)
    setDragPayload({ dayIndex, activityIndex })
  }

  const handleDragEnd = () => {
    setDragPayload(null)
    setDropTarget(null)
  }

  const handleDragOver = (
    event: React.DragEvent<HTMLElement>,
    dayIndex: number,
    activityIndex: number | null,
  ) => {
    event.preventDefault()

    if (!dragPayload) {
      return
    }

    setDropTarget({ dayIndex, activityIndex })
  }

  const handleDrop = (event: React.DragEvent<HTMLElement>, dayIndex: number, activityIndex: number | null) => {
    event.preventDefault()

    if (!dragPayload) {
      return
    }

    setPlannerDays((currentDays) => movePlannerActivity(currentDays, dragPayload, dayIndex, activityIndex))
    setDragPayload(null)
    setDropTarget(null)
  }

  const resetPlanner = () => {
    if (!trip) {
      return
    }

    setPlannerDays(normalizePlannerDays(trip.days))
    setDropTarget(null)
    setDragPayload(null)

    toast({
      title: "已恢复原始编排",
      description: "路线顺序已回到初始推荐方案。",
    })
  }

  const savePlannerLayout = async () => {
    if (!trip) {
      return
    }

    try {
      setIsSavingLayout(true)
      const updatedDays = normalizePlannerDays(plannerDays)
      const updatedTrip = await tripAPI.updateTrip(trip.id, {
        days: updatedDays,
        highlights: buildHighlightsFromDays(updatedDays, trip.highlights),
        title: `${trip.destination} ${updatedDays.length} 日游`,
      })

      setTrip(updatedTrip)
      setPlannerDays(normalizePlannerDays(updatedTrip.days))

      toast({
        title: "路线编排已保存",
        description: "新的停靠顺序和每日节奏已经更新到当前行程。",
      })
    } catch (saveError) {
      console.error("保存路线编排失败:", saveError)
      toast({
        title: "保存失败",
        description: "暂时无法保存新的路线顺序，请稍后再试。",
        variant: "destructive",
      })
    } finally {
      setIsSavingLayout(false)
    }
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
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="relative overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-br from-sky-500/16 via-background to-emerald-500/14 p-6 md:p-8">
          <div className="absolute -left-10 top-12 h-40 w-40 rounded-full bg-sky-500/12 blur-3xl" />
          <div className="absolute -right-14 bottom-0 h-48 w-48 rounded-full bg-emerald-500/14 blur-3xl" />
          <div className="relative space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                    路线方案
                  </Badge>
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    {trip.travelers} 人同行
                  </Badge>
                  <Badge variant="outline" className="border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300">
                    {travelStyleMeta?.label}
                  </Badge>
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{trip.destination} 路线编排台</h1>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                    {formatDisplayDate(trip.startDate)} - {formatDisplayDate(trip.endDate)} · {getTripDuration(trip)} 天
                    节奏安排。拖拽下面的活动卡片，就能实时重组每日路线、查看路径变化并保存新的方案。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {normalizedDays.map((day, dayIndex) => (
                    <div
                      key={day.day}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm backdrop-blur-sm",
                        getDayTheme(dayIndex).badge,
                      )}
                    >
                      Day {day.day} · {day.title}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <Button variant="outline" size="sm" onClick={toggleSave}>
                  <Heart className={cn("mr-2 h-4 w-4", isSaved && "fill-red-500 text-red-500")} />
                  {isSaved ? "已收藏" : "收藏"}
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="mr-2 h-4 w-4" />
                  分享
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  下载
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TripMetricCard title="总预算" value={`¥${trip.budget.toLocaleString()}`} caption="按人均口径估算，含交通与主要活动" />
              <TripMetricCard title="停靠点" value={`${totalActivities}`} caption={`${normalizedDays.length} 天内可拖拽重排的活动节点`} />
              <TripMetricCard title="路线段数" value={`${totalTransitSegments}`} caption="根据当前顺序生成的可视化路径段" />
              <TripMetricCard title="旅行风格" value={travelStyleMeta?.label ?? trip.travelStyle} caption={travelStyleMeta?.description ?? ""} />
            </div>
          </div>
        </section>

        <Tabs defaultValue="itinerary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl border border-border/70 bg-card/80 p-1">
            <TabsTrigger value="itinerary">路线编排</TabsTrigger>
            <TabsTrigger value="map">可视化地图</TabsTrigger>
            <TabsTrigger value="info">实用信息</TabsTrigger>
          </TabsList>

          <TabsContent value="itinerary" className="space-y-6">
            <Card className="overflow-hidden rounded-[28px] border border-border/70">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Route className="h-5 w-5 text-primary" />
                    行程编排台
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    直接拖拽活动卡片即可调整顺序，也可以跨天挪动停靠点。右侧会同步刷新路线图。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={resetPlanner} disabled={!hasPlannerChanges || isSavingLayout}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    还原推荐顺序
                  </Button>
                  <Button onClick={savePlannerLayout} disabled={!hasPlannerChanges || isSavingLayout}>
                    {isSavingLayout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    保存新编排
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
              <div className="grid gap-4 md:grid-cols-2">
                {normalizedDays.map((day, dayIndex) => (
                  <PlannerDayCard
                    key={day.day}
                    day={day}
                    dayIndex={dayIndex}
                    dragPayload={dragPayload}
                    dropTarget={dropTarget}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))}
              </div>

              <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
                <Card className="overflow-hidden rounded-[28px] border border-border/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      实时路线预览
                    </CardTitle>
                    <CardDescription>拖动左侧节点后，这里的路径和热区会马上变化。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TripRouteMap days={normalizedDays} compact />
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border border-border/70">
                  <CardHeader>
                    <CardTitle>节奏拆解</CardTitle>
                    <CardDescription>快速判断每天路线是否均衡，哪里适合留白。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {normalizedDays.map((day, dayIndex) => {
                      const firstStop = day.activities[0]
                      const lastStop = day.activities[day.activities.length - 1]

                      return (
                        <div key={day.day} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-semibold", getDayTheme(dayIndex).marker)}>
                                {day.day}
                              </div>
                              <div>
                                <p className="font-medium">{day.title}</p>
                                <p className="text-sm text-muted-foreground">{day.activities.length} 个停靠点</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={getDayTheme(dayIndex).badge}>
                              {day.activities.length >= 4 ? "节奏紧凑" : "节奏舒展"}
                            </Badge>
                          </div>
                          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <p>起点：{firstStop?.time} · {firstStop?.title}</p>
                            <p>终点：{lastStop?.time} · {lastStop?.title}</p>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="map" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
              <Card className="overflow-hidden rounded-[28px] border border-border/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    可视化地图
                  </CardTitle>
                  <CardDescription>这是一张用于行程推演的视觉化路线图，强调停靠点关系和移动节奏。</CardDescription>
                </CardHeader>
                <CardContent>
                  <TripRouteMap days={normalizedDays} />
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border border-border/70">
                <CardHeader>
                  <CardTitle>路径清单</CardTitle>
                  <CardDescription>按照当前拖拽顺序汇总出的完整游玩路径。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {routeStops.map((stop, index) => {
                    const meta = getActivityMeta(stop.type)
                    const Icon = meta.icon
                    const nextStop = routeStops[index + 1]

                    return (
                      <div key={stop.id} className="relative rounded-2xl border border-border/60 bg-muted/30 p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn("mt-1 rounded-2xl p-2", meta.halo)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">Day {stop.dayNumber}</p>
                              <Badge variant="outline" className={meta.badge}>
                                {stop.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{stop.time}</span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{stop.title}</p>
                          </div>
                        </div>
                        {nextStop && (
                          <div className="mt-3 flex items-center gap-2 pl-12 text-xs text-muted-foreground">
                            <span>接下来前往</span>
                            <Route className="h-3.5 w-3.5" />
                            <span>{nextStop.title}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="info" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-[28px] border border-border/70">
                <CardHeader>
                  <CardTitle>交通信息</CardTitle>
                  <CardDescription>根据当前路线节奏挑选更顺手的出行方式。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-7 text-muted-foreground">
                    {trip.destination === "东京"
                      ? "东京公共交通密集，地铁与 JR 切换效率高，建议优先将跨区移动集中在下午和傍晚时段。"
                      : `${trip.destination} 的通勤建议会根据当前路线和停靠点数量动态调整。`}
                  </p>
                  <div className="grid gap-4">
                    {trip.practicalInfo.transportation.map((item, index) => (
                      <div key={index} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                            <Train className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">约 ¥{item.cost.toLocaleString()} / 天</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border border-border/70">
                <CardHeader>
                  <CardTitle>住宿推荐</CardTitle>
                  <CardDescription>优先挑选更贴近当前路线重心的落脚点。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    {trip.practicalInfo.accommodation.map((item, index) => (
                      <div key={index} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                            <Hotel className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">约 ¥{item.cost.toLocaleString()} / 晚</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-4 text-sm leading-7 text-muted-foreground">
                    如果你把更多晚间活动拖到某一天，建议把住宿优先放到最后一站附近，减少回程折返。
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-[28px] border border-border/70">
              <CardHeader>
                <CardTitle>实用提示</CardTitle>
                <CardDescription>这些建议更适合当前这条路线的游玩节奏。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {trip.practicalInfo.tips.map((tip, index) => (
                    <div key={index} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <p className="text-sm leading-7 text-muted-foreground">{tip}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="overflow-hidden rounded-[28px] border border-border/70">
          <CardHeader>
            <CardTitle>可延展推荐</CardTitle>
            <CardDescription>如果你想再拉长路线或替换一站，这些点很适合接入当前节奏。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {trip.recommendations.map((spot, index) => (
                <div key={index} className="rounded-[24px] border border-border/60 bg-gradient-to-br from-muted/30 via-background to-primary/5 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-medium">{spot.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{spot.type}</p>
                </div>
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

function TripMetricCard({
  title,
  value,
  caption,
}: {
  title: string
  value: string
  caption: string
}) {
  return (
    <div className="rounded-[24px] border border-border/60 bg-background/70 p-4 backdrop-blur-sm">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{caption}</p>
    </div>
  )
}

function PlannerDayCard({
  day,
  dayIndex,
  dragPayload,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  day: TripDay
  dayIndex: number
  dragPayload: DragPayload | null
  dropTarget: { dayIndex: number; activityIndex: number | null } | null
  onDragStart: (event: React.DragEvent<HTMLDivElement>, dayIndex: number, activityIndex: number) => void
  onDragEnd: () => void
  onDragOver: (event: React.DragEvent<HTMLElement>, dayIndex: number, activityIndex: number | null) => void
  onDrop: (event: React.DragEvent<HTMLElement>, dayIndex: number, activityIndex: number | null) => void
}) {
  const theme = getDayTheme(dayIndex)

  return (
    <section
      className={cn("rounded-[28px] border p-5", theme.panel)}
      style={{ boxShadow: `0 30px 60px -45px ${theme.glow}` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold", theme.marker)}>
              {day.day}
            </div>
            <div>
              <p className="font-semibold">第 {day.day} 天</p>
              <p className="text-sm text-muted-foreground">{day.title}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={theme.badge}>
          {day.activities.length} 站
        </Badge>
      </div>

      <div className="relative mt-5 space-y-3 pl-1">
        <div className="absolute left-[1.65rem] top-4 bottom-14 w-px rounded-full bg-gradient-to-b from-primary/30 via-primary/15 to-transparent" />
        {day.activities.map((activity, activityIndex) => (
          <PlannerActivityCard
            key={`${day.day}-${activityIndex}-${activity.title}`}
            activity={activity}
            dayIndex={dayIndex}
            activityIndex={activityIndex}
            isDragging={
              dragPayload?.dayIndex === dayIndex && dragPayload?.activityIndex === activityIndex
            }
            isDropTarget={
              dropTarget?.dayIndex === dayIndex && dropTarget?.activityIndex === activityIndex
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        ))}
      </div>

      <div
        className={cn(
          "mt-4 rounded-2xl border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground transition-colors",
          dropTarget?.dayIndex === dayIndex && dropTarget?.activityIndex === null && "border-primary bg-primary/5 text-primary",
        )}
        onDragOver={(event) => onDragOver(event, dayIndex, null)}
        onDrop={(event) => onDrop(event, dayIndex, null)}
      >
        拖拽到这里，追加到当天最后一站
      </div>
    </section>
  )
}

function PlannerActivityCard({
  activity,
  dayIndex,
  activityIndex,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  activity: TripActivity
  dayIndex: number
  activityIndex: number
  isDragging: boolean
  isDropTarget: boolean
  onDragStart: (event: React.DragEvent<HTMLDivElement>, dayIndex: number, activityIndex: number) => void
  onDragEnd: () => void
  onDragOver: (event: React.DragEvent<HTMLElement>, dayIndex: number, activityIndex: number | null) => void
  onDrop: (event: React.DragEvent<HTMLElement>, dayIndex: number, activityIndex: number | null) => void
}) {
  const meta = getActivityMeta(activity.type)
  const Icon = meta.icon

  return (
    <div
      draggable
      className={cn(
        "group relative ml-4 rounded-[24px] border border-border/70 bg-background/85 p-4 backdrop-blur-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-lg",
        isDragging && "scale-[0.99] opacity-45",
        isDropTarget && "border-primary shadow-md shadow-primary/10",
      )}
      onDragStart={(event) => onDragStart(event, dayIndex, activityIndex)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, dayIndex, activityIndex)}
      onDrop={(event) => onDrop(event, dayIndex, activityIndex)}
    >
      <div className="absolute -left-6 top-6 flex h-7 w-7 items-center justify-center rounded-full border border-background bg-primary text-[11px] font-semibold text-primary-foreground shadow">
        {activityIndex + 1}
      </div>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 rounded-2xl p-2", meta.halo)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {activity.time}
            </div>
            <Badge variant="outline" className={meta.badge}>
              {activity.type}
            </Badge>
          </div>
          <p className="mt-3 font-medium">{activity.title}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{activity.description}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-2 text-muted-foreground transition-colors group-hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function TripRouteMap({ days, compact = false }: { days: TripDay[]; compact?: boolean }) {
  const gradientId = useId().replace(/:/g, "")
  const shadowId = useId().replace(/:/g, "")
  const routeStops = buildRouteStops(days)
  const routePath = buildRoutePath(routeStops)
  const spotlightStops = compact
    ? routeStops.filter((stop) => stop.activityIndex === 0)
    : routeStops.filter(
        (stop) => stop.activityIndex === 0 || stop.activityIndex === days[stop.dayIndex].activities.length - 1,
      )

  const mapBlocks = [
    { left: "6%", top: "12%", width: "17%", height: "18%", rotate: "-6deg" },
    { left: "22%", top: "55%", width: "14%", height: "14%", rotate: "8deg" },
    { left: "42%", top: "18%", width: "19%", height: "16%", rotate: "5deg" },
    { left: "58%", top: "58%", width: "16%", height: "15%", rotate: "-8deg" },
    { left: "77%", top: "26%", width: "14%", height: "20%", rotate: "9deg" },
  ]

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <div
        className={cn(
          "relative overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-slate-100 via-background to-sky-50 dark:from-slate-950 dark:to-slate-900",
          compact ? "aspect-[16/11]" : "aspect-[16/10]",
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.15),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_40%)]" />
        {mapBlocks.map((block, index) => (
          <div
            key={index}
            className="absolute rounded-[24px] border border-white/50 bg-white/40 backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
            style={{
              left: block.left,
              top: block.top,
              width: block.width,
              height: block.height,
              transform: `rotate(${block.rotate})`,
            }}
          />
        ))}

        <svg viewBox="0 0 1000 560" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <filter id={shadowId}>
              <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0f172a" floodOpacity="0.15" />
            </filter>
          </defs>

          <path
            d={routePath}
            fill="none"
            stroke="rgba(148, 163, 184, 0.28)"
            strokeWidth={compact ? 18 : 22}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={compact ? "8 18" : "12 22"}
          />
          <path
            d={routePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={compact ? 8 : 10}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${shadowId})`}
          />

          {routeStops.map((stop, index) => (
            <g key={stop.id}>
              <circle cx={stop.x} cy={stop.y} r={compact ? 12 : 14} fill="white" stroke={stop.color} strokeWidth="4" />
              <circle cx={stop.x} cy={stop.y} r={compact ? 4.5 : 5} fill={stop.color} />
              {!compact && (
                <text
                  x={stop.x}
                  y={stop.y - 20}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-medium"
                >
                  {index + 1}
                </text>
              )}
            </g>
          ))}
        </svg>

        {spotlightStops.map((stop) => (
          <div
            key={`${stop.id}-label`}
            className="absolute rounded-2xl border border-white/60 bg-background/92 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
            style={{
              left: `calc(${(stop.x / 1000) * 100}% - ${compact ? 54 : 64}px)`,
              top: `calc(${(stop.y / 560) * 100}% - ${compact ? 46 : 54}px)`,
            }}
          >
            <p className="font-semibold text-foreground">Day {stop.dayNumber}</p>
            <p className="mt-1 max-w-[120px] truncate text-muted-foreground">{stop.title}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {days.map((day, dayIndex) => (
          <div
            key={day.day}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              getDayTheme(dayIndex).badge,
            )}
          >
            Day {day.day} · {day.activities.length} 站
          </div>
        ))}
      </div>
    </div>
  )
}
