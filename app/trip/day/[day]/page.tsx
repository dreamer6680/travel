"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Clock, Loader2, MapPin, Utensils } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { tripAPI } from "@/lib/api"

interface TripDay {
  day: number
  title: string
  activities: {
    time: string
    title: string
    type: string
    description: string
  }[]
}

interface TripDetail {
  id: string
  destination: string
  days: TripDay[]
}

export default function TripDayPage() {
  const params = useParams<{ day: string }>()
  const searchParams = useSearchParams()
  const tripId = searchParams.get("id")
  const selectedDayNumber = Number(params.day)

  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTrip() {
      if (!tripId) {
        setError("缺少行程 ID")
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const data = await tripAPI.getTrip(tripId)
        setTrip(data)
      } catch (fetchError) {
        console.error("获取行程日程失败:", fetchError)
        setError("获取当日行程失败，请稍后再试")
      } finally {
        setIsLoading(false)
      }
    }

    fetchTrip()
  }, [tripId])

  const selectedDay = trip?.days.find((day) => day.day === selectedDayNumber) ?? null

  const getActivityIcon = (type: string) => {
    if (type === "餐厅") {
      return <Utensils className="h-4 w-4" />
    }

    return <MapPin className="h-4 w-4" />
  }

  if (isLoading) {
    return (
      <div className="container py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg">正在加载当日行程...</p>
        </div>
      </div>
    )
  }

  if (error || !trip || !selectedDay) {
    return (
      <div className="container py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-red-500">加载失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || "未找到对应日期的行程安排"}</p>
            <Button className="mt-4" asChild>
              <Link href={tripId ? `/trip/result?id=${tripId}` : "/trips"}>返回行程详情</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" className="pl-0" asChild>
          <Link href={`/trip/result?id=${trip.id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回行程总览
          </Link>
        </Button>

        <div>
          <h1 className="text-3xl font-bold">
            {trip.destination} 第 {selectedDay.day} 天
          </h1>
          <p className="text-muted-foreground mt-2">{selectedDay.title}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>当日安排</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedDay.activities.map((activity, index) => (
              <div key={`${selectedDay.day}-${index}`} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{activity.time}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">{getActivityIcon(activity.type)}</div>
                      <h2 className="text-lg font-medium">{activity.title}</h2>
                    </div>
                  </div>
                  <Badge variant="outline">{activity.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-3">{activity.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
