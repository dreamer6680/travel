"use client"

import { useState, useMemo, useEffect } from "react"
import { TripMap } from "./trip-map"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Route, Clock, Utensils, ShoppingBag, Camera } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTripActivityType, type TripActivityStored, type EnrichedDay, type TransitSegment } from "@/lib/types/trip"

interface Coordinate {
  lat: number
  lng: number
}

interface ActivityWithLocation extends TripActivityStored {
  coordinate?: Coordinate
}

type DayWithLocations = EnrichedDay | {
  day: number
  title: string
  activities: ActivityWithLocation[]
  transitSegments?: TransitSegment[]
}

interface TripRouteMapProps {
  destination: string
  days: DayWithLocations[]
  allLocations: Array<{ name: string; coordinate: Coordinate }>
  className?: string
  /** 地图高度，默认 400px */
  mapHeight?: string
}

const DAY_COLORS = [
  "#1677ff",  // 蓝
  "#52c41a",  // 绿
  "#fa8c16",  // 橙
  "#eb2f96",  // 粉
  "#722ed1",  // 紫
  "#13c2c2",  // 青
  "#f5222d",  // 红
  "#a0d911",  // 黄绿
]

function getActivityIcon(from: string) {
  const t = from.toLowerCase()
  if (t === "restaurant") {
    return <Utensils className="h-3.5 w-3.5" />
  }
  if (t === "hotel") {
    return <MapPin className="h-3.5 w-3.5" />
  }
  if (t === "recommendation") return <Camera className="h-3.5 w-3.5" />
  if (t === "others") return <ShoppingBag className="h-3.5 w-3.5" />
  return <Camera className="h-3.5 w-3.5" />
}

function isValidCoord(coord?: Coordinate): coord is Coordinate {
  return (
    !!coord &&
    typeof coord.lat === "number" &&
    typeof coord.lng === "number" &&
    !isNaN(coord.lat) &&
    !isNaN(coord.lng)
  )
}

export function TripRouteMap({ destination, days, allLocations, className = "", mapHeight = "420px" }: TripRouteMapProps) {
  // 自动选择第一天
  const [selectedDay, setSelectedDay] = useState<number>(days[0]?.day ?? 1)
  // 当前聚焦的活动序号（1-based，对应地图标记序号）
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null)

  // 当 days 数据更新时，如果当前选择的天不存在则重置
  useEffect(() => {
    if (days.length > 0 && !days.find((d) => d.day === selectedDay)) {
      setSelectedDay(days[0].day)
    }
    setActiveMarkerIndex(null)
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  // 切换天时清空聚焦
  const handleSelectDay = (day: number) => {
    setSelectedDay(day)
    setActiveMarkerIndex(null)
  }

  const currentDay = useMemo(
    () => days.find((d) => d.day === selectedDay) ?? days[0],
    [days, selectedDay]
  )

  // 地图中心（当前天的活动平均坐标）
  const mapCenter = useMemo(() => {
    const coords: Coordinate[] = []
    if (currentDay) {
      currentDay.activities.forEach((a) => { if (isValidCoord(a.coordinate)) coords.push(a.coordinate) })
    }
    if (coords.length === 0 && allLocations.length > 0) {
      allLocations.forEach((l) => { if (isValidCoord(l.coordinate)) coords.push(l.coordinate) })
    }
    if (coords.length === 0) return { lat: 39.9042, lng: 116.4074 }
    return {
      lat: (Math.max(...coords.map((c) => c.lat)) + Math.min(...coords.map((c) => c.lat))) / 2,
      lng: (Math.max(...coords.map((c) => c.lng)) + Math.min(...coords.map((c) => c.lng))) / 2,
    }
  }, [currentDay, allLocations])

  const dayColor = DAY_COLORS[(selectedDay - 1) % DAY_COLORS.length]

  // 生成编号标记
  const markers = useMemo(() => {
    if (!currentDay) return []
    let idx = 0
    return currentDay.activities
      .filter((a) => isValidCoord(a.coordinate))
      .map((a) => {
        idx++
        return {
          position: a.coordinate!,
          title: a.title ?? "地点",
          content: `${a.time}`,
          index: idx,
          color: dayColor,
          type: a.from,
        }
      })
  }, [currentDay, dayColor])

  /**
   * 检测服务端是否已为所有相邻有坐标活动对提供了真实 polyline。
   * 若是，不再传 transitStops，彻底屏蔽客户端 AMap.Transfer 调用。
   */
  const allSegmentsHaveServerPolyline = useMemo(() => {
    if (!currentDay?.transitSegments?.length) return false
    const validWithIdx = currentDay.activities
      .map((a: ActivityWithLocation, i: number) => ({ a, i }))
      .filter(({ a }) => isValidCoord(a.coordinate))
    if (validWithIdx.length < 2) return false
    const segMap = new Map(
      currentDay.transitSegments.map((s: TransitSegment) => [`${s.fromIndex}-${s.toIndex}`, s])
    )
    return validWithIdx.slice(0, -1).every(({ i }, idx) => {
      const nextI = validWithIdx[idx + 1].i
      const seg = segMap.get(`${i}-${nextI}`)
      return seg?.route?.polyline && seg.route.polyline.length >= 2
    })
  }, [currentDay])

  /** 仅当服务端 polyline 不完整时传给 TripMap，触发客户端 AMap.Transfer 补全 */
  const orderedActivityCoords = useMemo(() => {
    if (allSegmentsHaveServerPolyline) return undefined
    if (!currentDay) return undefined
    const pts: Coordinate[] = []
    for (const a of currentDay.activities) {
      if (isValidCoord(a.coordinate)) pts.push(a.coordinate)
    }
    return pts.length >= 2 ? pts : undefined
  }, [currentDay, allSegmentsHaveServerPolyline])

  /** 公交换乘规划用城市名（高德 city 参数） */
  const transitCityName = useMemo(
    () => destination.replace(/市\s*$/, "").trim() || destination.trim() || "上海",
    [destination],
  )

  // 生成路线：优先使用高德 API 返回的真实路径，否则降级为直线
  const polylines = useMemo(() => {
    if (!currentDay) return []
    const validActs = currentDay.activities.filter((a) => isValidCoord(a.coordinate))
    if (validActs.length < 2) return []

    // 建立 fromIndex-toIndex → transitSegment 的映射（用原始活动下标）
    const transitMap = new Map<string, TransitSegment>(
      (currentDay.transitSegments ?? []).map((s) => [`${s.fromIndex}-${s.toIndex}`, s])
    )

    // 根据有坐标的活动重新计算其在原始 activities 数组中的下标
    const validActsWithIdx = currentDay.activities
      .map((a, i) => ({ act: a, origIdx: i }))
      .filter(({ act }) => isValidCoord(act.coordinate))

    return validActsWithIdx.slice(0, -1).map(({ act, origIdx }, i) => {
      const nextOrigIdx = validActsWithIdx[i + 1].origIdx
      const seg = transitMap.get(`${origIdx}-${nextOrigIdx}`)
      const realPath = seg?.route?.polyline

      // 真实路径（公交 / 步行）：用 API 坐标；否则直线连接
      const path: Coordinate[] =
        realPath && realPath.length >= 2
          ? realPath
          : [act.coordinate!, validActsWithIdx[i + 1].act.coordinate!]

      // 判断是否为步行（所有 segment 都是步行则为步行色，否则用公交色）
      const isWalkOnly =
        !!seg && seg.route.segments.every((s) => s.type === "步行")
      const isTransit = !!seg && !isWalkOnly

      return {
        path,
        strokeColor: isTransit ? "#13c2c2" : isWalkOnly ? "#52c41a" : dayColor,
        strokeWeight: realPath && realPath.length >= 2 ? 4 : 3,
        strokeOpacity: 0.85,
        strokeStyle: (isWalkOnly ? "dashed" : "solid") as "solid" | "dashed",
      }
    })
  }, [currentDay, dayColor])

  const hasCoords = markers.length > 0

  // 计算当日活动间总距离
  const dayDistance = useMemo(() => {
    if (!currentDay) return 0
    const validActs = currentDay.activities.filter((a) => isValidCoord(a.coordinate))
    let dist = 0
    for (let i = 0; i < validActs.length - 1; i++) {
      const a = validActs[i].coordinate!
      const b = validActs[i + 1].coordinate!
      const R = 6371
      const dLat = ((b.lat - a.lat) * Math.PI) / 180
      const dLng = ((b.lng - a.lng) * Math.PI) / 180
      const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
      dist += 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
    }
    return dist
  }, [currentDay])

  // 每天地图上实际有坐标的活动数（用于帮助文字）
  const validCount = currentDay?.activities.filter((a) => isValidCoord(a.coordinate)).length ?? 0

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            行程地图
          </CardTitle>
          <div className="flex items-center gap-2">
            {validCount > 0 && (
              <span className="text-xs text-muted-foreground">{validCount} 个地点</span>
            )}
            {dayDistance > 0.5 && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Route className="h-3 w-3" />
                约 {dayDistance.toFixed(1)} 公里
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* 天数选择 */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
          {days.map((day, idx) => {
            const color = DAY_COLORS[idx % DAY_COLORS.length]
            const isSelected = day.day === selectedDay
            const cnt = day.activities.filter((a) => isValidCoord(a.coordinate)).length
            return (
              <button
                key={day.day}
                onClick={() => handleSelectDay(day.day)}
                className={cn(
                  "flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-all flex items-center gap-1",
                  isSelected ? "text-white shadow-sm" : "bg-transparent text-muted-foreground hover:bg-muted"
                )}
                style={isSelected ? { backgroundColor: color, borderColor: color } : { borderColor: "#e5e7eb" }}
              >
                第 {day.day} 天
                {cnt > 0 && (
                  <span
                    className={cn("rounded-full w-4 h-4 flex items-center justify-center text-[9px]",
                      isSelected ? "bg-white/30" : "bg-muted")}
                  >{cnt}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* 地图区域 */}
        {hasCoords ? (
          <TripMap
            center={mapCenter}
            markers={markers}
            polylines={polylines}
            transitStops={orderedActivityCoords}
            transitCity={transitCityName}
            height={mapHeight}
            className="w-full rounded-none"
            activeIndex={activeMarkerIndex}
          />
        ) : (
          <div className="flex items-center justify-center bg-muted/40 mx-4 mb-4 rounded-xl" style={{ height: "200px" }}>
            <div className="text-center text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">当日暂无坐标数据</p>
            </div>
          </div>
        )}

        {/* 活动时间轴列表 —— 点击跳转地图 */}
        {currentDay && currentDay.activities.length > 0 && (
          <div className="px-4 pt-3 pb-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              {currentDay.title}
              <span className="normal-case font-normal text-muted-foreground/60">· 点击地点可定位地图</span>
            </p>
            <div className="space-y-0">
              {currentDay.activities.map((act, idx) => {
                const hasCoord = isValidCoord(act.coordinate)
                // 当前活动在有坐标活动中的序号（即地图标记序号）
                const markerIdx = hasCoord
                  ? currentDay.activities
                      .slice(0, idx + 1)
                      .filter((a) => isValidCoord(a.coordinate)).length
                  : null
                const isActive = markerIdx !== null && activeMarkerIndex === markerIdx

                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-3 group rounded-lg transition-colors",
                      hasCoord ? "cursor-pointer hover:bg-muted/50" : "opacity-60",
                      isActive && "bg-muted"
                    )}
                    onClick={() => {
                      if (!hasCoord || markerIdx === null) return
                      setActiveMarkerIndex(isActive ? null : markerIdx)
                    }}
                  >
                    {/* 时间轴线 */}
                    <div className="flex flex-col items-center ml-1">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-2 transition-transform",
                          isActive && "scale-110 shadow-md"
                        )}
                        style={{ backgroundColor: hasCoord ? dayColor : "#d1d5db" }}
                      >
                        {markerIdx ?? "·"}
                      </div>
                      {idx < currentDay.activities.length - 1 && (
                        <div
                          className="w-0.5 flex-1 my-0.5 min-h-[8px]"
                          style={{ backgroundColor: hasCoord ? `${dayColor}30` : "#e5e7eb" }}
                        />
                      )}
                    </div>

                    {/* 活动内容 */}
                    <div className="py-2 pr-2 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {act.time}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 flex items-center gap-0.5">
                          {getActivityIcon(act.from)}
                          {formatTripActivityType(act.from)}
                        </Badge>
                        {hasCoord && (
                          <MapPin className={cn("h-3 w-3 ml-auto flex-shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground/40 group-hover:text-primary/60"
                          )} />
                        )}
                      </div>
                      <p className={cn(
                        "text-sm font-medium mt-0.5 truncate",
                        isActive && "text-primary"
                      )}>{act.title ?? "地点"}</p>
                      {act.location && act.location !== destination && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-0.5 mt-0.5 truncate">
                          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                          {act.location}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
