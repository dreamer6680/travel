"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Share2, Heart, Download, MapPin, Utensils, Train, Hotel, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { tripAPI } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"

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
    transportation: { name: string; cost: number; icon: string }[]
    accommodation: { name: string; cost: number; icon: string }[]
    tips: string[]
  }
}

const TRAVEL_STYLE_MAP: Record<string, { label: string; desc: string }> = {
  relaxed: { label: "休闲放松", desc: "注重休闲与放松" },
  balanced: { label: "平衡兼顾", desc: "兼顾热门景点和当地体验" },
  intensive: { label: "密集行程", desc: "高效游览更多景点" },
  adventure: { label: "探险冒险", desc: "注重户外和冒险体验" },
  cultural: { label: "文化体验", desc: "深入了解当地文化" },
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function DayActivityBlock({
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
  const icon =
    type === "餐厅" ? (
      <Utensils className="h-4 w-4 text-primary" />
    ) : (
      <MapPin className="h-4 w-4 text-primary" />
    )
  return (
    <div className="flex gap-4 py-3 first:pt-0">
      <div className="flex shrink-0 flex-col items-center">
        <span className="text-sm font-medium text-muted-foreground">{time}</span>
        <div className="mt-1 h-full w-px min-h-[2rem] bg-border" />
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
            {icon}
          </span>
          <h4 className="font-medium">{title}</h4>
          <Badge variant="outline" className="text-xs">
            {type}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

export default function Result2Page() {
  const router = useRouter()
  const { toast } = useToast()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("trip")
      if (!raw) {
        setError("未找到行程数据")
        return
      }
      const data = JSON.parse(raw) as Trip
      setTrip(data)
    } catch {
      setError("获取行程数据失败，请稍后再试")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleConfirmTrip = () => {
    if (!trip) return
    tripAPI.confirmTrip(trip).then((res) => {
      if (res.status === 200) {
        toast({ title: "行程确认成功", description: "行程已确认，请等待审核" })
        router.push("/trip")
      } else {
        toast({ title: "行程确认失败", description: "请稍后再试" })
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

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center py-8">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
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

  const daysCount = Math.ceil(
    (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24),
  )
  const styleInfo = TRAVEL_STYLE_MAP[trip.travelStyle] ?? {
    label: trip.travelStyle,
    desc: "",
  }

  return (
    <div className="w-full py-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* 1. Hero */}
        <section className="rounded-2xl bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-8 md:p-10 border border-border/50">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {trip.destination} {daysCount} 日游
          </h1>
          <p className="mt-2 text-muted-foreground">
            {formatDate(trip.startDate)} — {formatDate(trip.endDate)} · {trip.travelers} 人
          </p>
        </section>

        {/* 2. 摘要卡片 */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">总预算</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">¥{trip.budget.toLocaleString()} / 人</p>
              <p className="text-sm text-muted-foreground">含交通、住宿与主要活动</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">行程风格</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{styleInfo.label}</p>
              {styleInfo.desc && (
                <p className="text-sm text-muted-foreground">{styleInfo.desc}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">行程亮点</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {trip.highlights.map((h, i) => (
                  <Badge key={i} variant="secondary">
                    {h}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 3. 行程主体：按天卡片 + 时间线 */}
        <section>
          <h2 className="text-xl font-semibold mb-6">{trip.days.length} 天行程安排</h2>
          <div className="space-y-6">
            {trip.days.map((day) => (
              <Card key={day.day} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">第 {day.day} 天</span>
                    <Badge variant="outline">{day.title}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="relative">
                    {day.activities.map((act, idx) => (
                      <DayActivityBlock
                        key={idx}
                        time={act.time}
                        title={act.title}
                        type={act.type}
                        description={act.description}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/trip/day/${day.day}?id=${trip.id}`}>查看详情</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 4. 实用信息 */}
        <section>
          <h2 className="text-xl font-semibold mb-4">实用信息</h2>
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">交通</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {trip.practicalInfo.transportation.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
                    >
                      <Train className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ¥{item.cost.toLocaleString()}/天
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">住宿</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {trip.practicalInfo.accommodation.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
                    >
                      <Hotel className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ¥{item.cost.toLocaleString()}/晚
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {trip.practicalInfo.tips.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">小贴士</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {trip.practicalInfo.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 5. 推荐 + 操作栏 */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">推荐景点</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleSave}>
                <Heart
                  className={`mr-2 h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : ""}`}
                />
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
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {trip.recommendations.map((spot, i) => (
                  <div
                    key={i}
                    className="flex flex-col rounded-lg border bg-card p-4 overflow-hidden"
                  >
                    <div className="flex h-24 items-center justify-center rounded-md bg-muted">
                      <MapPin className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="mt-3">
                      <h3 className="font-medium">{spot.name}</h3>
                      <p className="text-sm text-muted-foreground">{spot.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <Button variant="outline" asChild>
                <Link href="/recommendations">查看更多推荐</Link>
              </Button>
              <Button onClick={handleConfirmTrip}>确认行程</Button>
            </CardFooter>
          </Card>
        </section>
      </div>
    </div>
  )
}
