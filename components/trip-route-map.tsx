"use client"

import { useState, useMemo } from "react"
import { TripMap } from "./trip-map"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Calendar, Route } from "lucide-react"

interface Coordinate {
  lat: number
  lng: number
}

interface Marker {
  position: Coordinate
  title: string
  content?: string
}

interface ActivityWithLocation {
  time: string
  title: string
  type: string
  description: string
  location?: string
  coordinate?: Coordinate
}

interface DayWithLocations {
  day: number
  title: string
  activities: ActivityWithLocation[]
}

interface TripRouteMapProps {
  destination: string
  days: DayWithLocations[]
  allLocations: Array<{
    name: string
    coordinate: Coordinate
  }>
  className?: string
}

// 每天使用不同的颜色
const DAY_COLORS = [
  "#1890ff", // 蓝色
  "#52c41a", // 绿色
  "#faad14", // 橙色
  "#f5222d", // 红色
  "#722ed1", // 紫色
  "#13c2c2", // 青色
  "#eb2f96", // 粉色
  "#fa8c16", // 橙红色
]

export function TripRouteMap({
  destination,
  days,
  allLocations,
  className = "",
}: TripRouteMapProps) {
  const [displayMode, setDisplayMode] = useState<"daily" | "overall">("daily")
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // 计算地图中心点
  const mapCenter = useMemo(() => {
    // 先尝试从 days 中获取坐标
    const allCoordinates: Coordinate[] = []
    days.forEach((day) => {
      day.activities.forEach((activity) => {
        if (activity.coordinate && 
            typeof activity.coordinate.lat === 'number' && 
            typeof activity.coordinate.lng === 'number') {
          allCoordinates.push(activity.coordinate)
        }
      })
    })
    
    // 如果从 days 中获取不到，使用 allLocations
    if (allCoordinates.length === 0 && allLocations.length > 0) {
      allLocations.forEach((loc) => {
        if (loc.coordinate && 
            typeof loc.coordinate.lat === 'number' && 
            typeof loc.coordinate.lng === 'number') {
          allCoordinates.push(loc.coordinate)
        }
      })
    }

    if (allCoordinates.length === 0) {
      return { lat: 39.9042, lng: 116.4074 } // 默认北京
    }

    const lats = allCoordinates.map((coord) => coord.lat)
    const lngs = allCoordinates.map((coord) => coord.lng)

    return {
      lat: (Math.max(...lats) + Math.min(...lats)) / 2,
      lng: (Math.max(...lngs) + Math.min(...lngs)) / 2,
    }
  }, [allLocations, days])

  // 生成标记点
  const markers = useMemo(() => {
    if (displayMode === "daily" && selectedDay !== null) {
      const day = days.find((d) => d.day === selectedDay)
      if (!day) return []

      return day.activities
        .filter((activity) => {
          const coord = activity.coordinate
          return coord && 
                 typeof coord.lat === 'number' && 
                 typeof coord.lng === 'number' &&
                 !isNaN(coord.lat) && 
                 !isNaN(coord.lng)
        })
        .map((activity) => ({
          position: activity.coordinate!,
          title: activity.title,
          content: `${activity.time}<br/>${activity.type}<br/>${activity.description}`,
        }))
    } else {
      // 整体模式：显示所有地点（优先使用 days 中的坐标）
      const markersFromDays: Marker[] = []
      days.forEach((day) => {
        day.activities.forEach((activity) => {
          const coord = activity.coordinate
          if (coord && 
              typeof coord.lat === 'number' && 
              typeof coord.lng === 'number' &&
              !isNaN(coord.lat) && 
              !isNaN(coord.lng)) {
            // 避免重复
            if (!markersFromDays.find(m => 
              m.position.lat === coord.lat && m.position.lng === coord.lng
            )) {
              markersFromDays.push({
                position: coord,
                title: activity.title,
                content: `${activity.time}<br/>${activity.type}`,
              })
            }
          }
        })
      })
      
      // 如果从 days 中获取不到，使用 allLocations
      if (markersFromDays.length > 0) {
        return markersFromDays
      }
      
      return allLocations
        .filter((location) => {
          const coord = location.coordinate
          return coord && 
                 typeof coord.lat === 'number' && 
                 typeof coord.lng === 'number' &&
                 !isNaN(coord.lat) && 
                 !isNaN(coord.lng)
        })
        .map((location) => ({
          position: location.coordinate,
          title: location.name,
          content: location.name,
        }))
    }
  }, [displayMode, selectedDay, days, allLocations])

  // 生成路线
  const polylines = useMemo(() => {
    // 验证坐标是否有效
    const isValidCoordinate = (coord: Coordinate | undefined): coord is Coordinate => {
      return !!coord && 
             typeof coord.lat === 'number' && 
             typeof coord.lng === 'number' &&
             !isNaN(coord.lat) && 
             !isNaN(coord.lng)
    }

    if (displayMode === "daily") {
      if (selectedDay === null) return []

      const day = days.find((d) => d.day === selectedDay)
      if (!day) return []

      const dayActivities = day.activities.filter((activity) => 
        isValidCoordinate(activity.coordinate)
      )
      if (dayActivities.length < 2) return []

      const color = DAY_COLORS[(selectedDay - 1) % DAY_COLORS.length]

      return [
        {
          path: dayActivities.map((activity) => activity.coordinate!),
          strokeColor: color,
          strokeWeight: 4,
          strokeOpacity: 0.8,
        },
      ]
    } else {
      // 整体模式：每天一条路线，不同颜色
      return days
        .map((day, dayIndex) => {
          const dayActivities = day.activities.filter((activity) => 
            isValidCoordinate(activity.coordinate)
          )
          if (dayActivities.length < 2) return null

          const color = DAY_COLORS[dayIndex % DAY_COLORS.length]

          return {
            path: dayActivities.map((activity) => activity.coordinate!),
            strokeColor: color,
            strokeWeight: 3,
            strokeOpacity: 0.6,
          }
        })
        .filter(Boolean) as Array<{
        path: Coordinate[]
        strokeColor: string
        strokeWeight: number
        strokeOpacity: number
      }>
    }
  }, [displayMode, selectedDay, days])

  // 计算总距离（估算）
  const totalDistance = useMemo(() => {
    let distance = 0
    const isValidCoordinate = (coord: Coordinate | undefined): coord is Coordinate => {
      return !!coord && 
             typeof coord.lat === 'number' && 
             typeof coord.lng === 'number' &&
             !isNaN(coord.lat) && 
             !isNaN(coord.lng)
    }
    
    days.forEach((day) => {
      const dayActivities = day.activities.filter((activity) => 
        isValidCoordinate(activity.coordinate)
      )
      for (let i = 0; i < dayActivities.length - 1; i++) {
        const from = dayActivities[i].coordinate!
        const to = dayActivities[i + 1].coordinate!
        // 使用 Haversine 公式计算距离
        const R = 6371 // 地球半径（公里）
        const dLat = ((to.lat - from.lat) * Math.PI) / 180
        const dLon = ((to.lng - from.lng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((from.lat * Math.PI) / 180) *
            Math.cos((to.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        distance += R * c
      }
    })
    return distance
  }, [days])

  // 检查是否有有效的坐标数据
  const hasValidCoordinates = useMemo(() => {
    // 检查 days 中是否有坐标
    const hasDaysCoordinates = days.some((day) =>
      day.activities.some((activity) => {
        const coord = activity.coordinate
        return coord && 
               typeof coord.lat === 'number' && 
               typeof coord.lng === 'number' &&
               !isNaN(coord.lat) && 
               !isNaN(coord.lng)
      })
    )
    
    // 检查 allLocations 中是否有坐标
    const hasAllLocationsCoordinates = allLocations.some((location) => {
      const coord = location.coordinate
      return coord && 
             typeof coord.lat === 'number' && 
             typeof coord.lng === 'number' &&
             !isNaN(coord.lat) && 
             !isNaN(coord.lng)
    })
    
    return hasDaysCoordinates || hasAllLocationsCoordinates
  }, [days, allLocations])

  if (!hasValidCoordinates) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>行程地图</CardTitle>
          <CardDescription>暂无地点信息</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">无法获取地点坐标</p>
              <p className="text-sm text-muted-foreground mt-2">
                请确保行程活动包含有效的地点坐标信息
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              行程地图
            </CardTitle>
            <CardDescription>查看您的行程在地图上的分布</CardDescription>
          </div>
          {displayMode === "overall" && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Route className="h-3 w-3" />
              总距离: {totalDistance.toFixed(1)} 公里
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={displayMode} onValueChange={(value) => setDisplayMode(value as "daily" | "overall")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily">按天显示</TabsTrigger>
            <TabsTrigger value="overall">整体路线</TabsTrigger>
          </TabsList>

          {displayMode === "daily" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {days.map((day) => (
                  <Button
                    key={day.day}
                    variant={selectedDay === day.day ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDay(selectedDay === day.day ? null : day.day)}
                    className="flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    第 {day.day} 天
                    {selectedDay === day.day && (
                      <Badge variant="secondary" className="ml-1">
                        {day.activities.filter((a) => a.coordinate).length} 个地点
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>

              {selectedDay === null && (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>请选择要查看的日期</p>
                </div>
              )}
            </div>
          )}

          {displayMode === "overall" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {days.map((day, index) => (
                  <Badge
                    key={day.day}
                    variant="outline"
                    style={{
                      borderColor: DAY_COLORS[index % DAY_COLORS.length],
                      color: DAY_COLORS[index % DAY_COLORS.length],
                    }}
                  >
                    第 {day.day} 天
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                不同颜色代表不同天的路线，共 {allLocations.length} 个地点
              </p>
            </div>
          )}
        </Tabs>

        <TripMap
          center={mapCenter}
          markers={markers}
          polylines={polylines}
          height="500px"
          className="w-full"
        />
      </CardContent>
    </Card>
  )
}
