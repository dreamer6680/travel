"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

export interface Coordinate {
  lat: number
  lng: number
}

export interface Marker {
  position: Coordinate
  title: string
  content?: string
  /** 标记序号（1, 2, 3…），有值时渲染为彩色数字圆圈 */
  index?: number
  /** 颜色（十六进制），用于编号圆圈 */
  color?: string
  /** 活动类型标签 */
  type?: string
}

interface Polyline {
  path: Coordinate[]
  strokeColor?: string
  strokeWeight?: number
  strokeOpacity?: number
  strokeStyle?: "solid" | "dashed"
}

/** 驾车/步行规划结果 → 折线点（GCJ02） */
function extractPathFromRoute(route: any): Coordinate[] {
  const out: Coordinate[] = []
  if (!route) return out
  const pushLngLat = (p: any) => {
    if (!p) return
    if (typeof p.lng === "number" && typeof p.lat === "number") {
      out.push({ lng: p.lng, lat: p.lat })
    } else if (typeof p.getLng === "function" && typeof p.getLat === "function") {
      out.push({ lng: p.getLng(), lat: p.getLat() })
    } else if (Array.isArray(p) && p.length >= 2) {
      out.push({ lng: Number(p[0]), lat: Number(p[1]) })
    }
  }
  if (Array.isArray(route.path) && route.path.length) {
    for (const p of route.path) pushLngLat(p)
    if (out.length >= 2) return out
  }
  if (!route.steps?.length) return out
  for (const step of route.steps) {
    const pts = step.path
    if (!pts?.length) continue
    for (const p of pts) pushLngLat(p)
  }
  return out
}

interface TripMapProps {
  center?: Coordinate
  zoom?: number
  markers?: Marker[]
  polylines?: Polyline[]
  height?: string
  className?: string
  /** 点击活动列表时传入要聚焦的标记序号（1-based），地图自动平移并弹出信息窗 */
  activeIndex?: number | null
  /**
   * 当日活动按顺序的 GCJ-02 坐标（景点/餐厅/酒店等）。
   * ≥2 点时优先用 AMap.Driving 一条驾车线（起点、终点、途经点），与高德 Web 示例一致；失败则回退到 polylines。
   */
  drivingRoutePoints?: Coordinate[]
  /** 驾车路线描边色（与当天主题色一致） */
  routeStrokeColor?: string
}

declare global {
  interface Window {
    AMap: any
  }
}

/** 活动类型 → emoji 图标 */
const TYPE_EMOJI: Record<string, string> = {
  餐厅: "🍜",
  咖啡厅: "☕",
  景点: "🏛️",
  博物馆: "🏛️",
  公园: "🌿",
  购物: "🛍️",
  休闲: "🌙",
  文化: "🎭",
  酒店: "🏨",
}

function getTypeEmoji(type?: string): string {
  if (!type) return "📍"
  for (const [k, v] of Object.entries(TYPE_EMOJI)) {
    if (type.includes(k)) return v
  }
  return "📍"
}

/** 生成编号标记的 HTML 内容 */
function makeMarkerHTML(index: number, color: string, type?: string): string {
  const emoji = getTypeEmoji(type)
  return `
<div style="
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transform: translateY(-50%);
">
  <div style="
    width: 32px; height: 32px;
    border-radius: 50%;
    background: ${color};
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    border: 2.5px solid white;
    box-shadow: 0 2px 10px rgba(0,0,0,0.35);
    position: relative;
  ">
    ${index}
    <div style="
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 7px solid ${color};
    "></div>
  </div>
  <div style="
    margin-top: 8px;
    font-size: 10px;
    background: white;
    border-radius: 3px;
    padding: 1px 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    white-space: nowrap;
    line-height: 1.4;
  ">${emoji}</div>
</div>`
}

/** 生成信息窗口 HTML */
function makeInfoWindowHTML(marker: Marker): string {
  const emoji = getTypeEmoji(marker.type)
  const badgeColor = marker.color || "#1890ff"
  return `
<div style="
  min-width: 180px; max-width: 240px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding: 10px 12px;
  line-height: 1.5;
">
  <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
    <span style="
      background:${badgeColor}; color:white;
      width:22px; height:22px; border-radius:50%;
      display:inline-flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:700; flex-shrink:0;
    ">${marker.index ?? "·"}</span>
    <strong style="font-size:13px; color:#1a1a1a;">${marker.title}</strong>
  </div>
  ${marker.type ? `<div style="font-size:11px; color:#888; margin-bottom:4px;">${emoji} ${marker.type}</div>` : ""}
  ${marker.content ? `<div style="font-size:12px; color:#555; white-space:pre-line;">${marker.content}</div>` : ""}
</div>`
}

export function TripMap({
  center = { lat: 39.9042, lng: 116.4074 },
  zoom = 13,
  markers = [],
  polylines = [],
  height = "400px",
  className = "",
  activeIndex = null,
  drivingRoutePoints,
  routeStrokeColor = "#1677ff",
}: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const polylinesRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isInitialized = useRef(false)
  /** 服务端未带 polyline 时，客户端驾车/步行规划后的路线（避免只画两点直线） */
  const [resolvedPolylines, setResolvedPolylines] = useState<Polyline[] | null>(null)
  const routeResolveGen = useRef(0)
  /** 多点 AMap.Driving 一条线（起点→途经→终点） */
  const [drivingPathResult, setDrivingPathResult] = useState<Coordinate[] | null>(null)
  const drivingPathGen = useRef(0)

  // 初始化地图（只执行一次）
  useEffect(() => {
    if (!mapRef.current || isInitialized.current) return
    isInitialized.current = true

    const loadMap = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const apiKey = process.env.NEXT_PUBLIC_AMAP_KEY
        if (!apiKey) throw new Error("NEXT_PUBLIC_AMAP_KEY 未配置")

        const sec = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE
        if (sec && typeof window !== "undefined") {
          ;(window as unknown as { _AMapSecurityConfig?: { securityJsCode: string } })._AMapSecurityConfig = {
            securityJsCode: sec,
          }
        }

        const AMapLoader = (await import("@amap/amap-jsapi-loader")).default
        const AMap = await AMapLoader.load({
          key: apiKey,
          version: "2.0",
          plugins: [
            "AMap.Marker",
            "AMap.InfoWindow",
            "AMap.Polyline",
            "AMap.Driving",
            "AMap.Walking",
          ],
        })

        const map = new AMap.Map(mapRef.current, {
          viewMode: "2D",
          zoom,
          center: [center.lng, center.lat],
          mapStyle: "amap://styles/normal",
        })
        mapInstanceRef.current = map

        // 共享信息窗口
        infoWindowRef.current = new AMap.InfoWindow({
          isCustom: true,
          autoMove: true,
          offset: new AMap.Pixel(0, -40),
        })

        setIsLoading(false)
      } catch (err: any) {
        let msg = "地图加载失败"
        if (err?.message?.includes("USERKEY_PLAT")) msg = "API Key 平台类型不匹配（需要 Web JS API 类型）"
        else if (err?.message?.includes("INVALID")) msg = "API Key 无效"
        else if (err?.message?.includes("NEXT_PUBLIC_AMAP_KEY")) msg = "API Key 未配置"
        setError(msg)
        setIsLoading(false)
      }
    }

    loadMap()
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
        isInitialized.current = false
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 同步 props → 先展示直线，再异步替换为驾车/步行真实路径
  useEffect(() => {
    setResolvedPolylines(null)
  }, [polylines])

  // 多点一条驾车线（与高德示例：起点、终点、waypoints 途经点）
  useEffect(() => {
    if (!drivingRoutePoints || drivingRoutePoints.length < 2 || isLoading) {
      setDrivingPathResult(null)
      return
    }
    const map = mapInstanceRef.current
    const AMap = window.AMap
    if (!map || !AMap) return

    const gen = ++drivingPathGen.current
    const pts = drivingRoutePoints
    const origin = pts[0]
    const dest = pts[pts.length - 1]

    AMap.plugin(["AMap.Driving"], () => {
      if (gen !== drivingPathGen.current) return
      const driving = new AMap.Driving({
        map: null,
        hideMarkers: true,
        showTraffic: false,
      })

      const onSearchDone = (status: string, result: any) => {
        if (gen !== drivingPathGen.current) return
        if (status !== "complete") {
          setDrivingPathResult(null)
          return
        }
        const dr = result?.routes?.[0] ?? result?.route
        const path = extractPathFromRoute(dr)
        setDrivingPathResult(path.length >= 2 ? path : null)
      }

      if (pts.length === 2) {
        driving.search(
          new AMap.LngLat(origin.lng, origin.lat),
          new AMap.LngLat(dest.lng, dest.lat),
          onSearchDone,
        )
      } else {
        const maxWp = 16
        const middle = pts.slice(1, -1)
        const waypoints = middle.slice(0, maxWp).map((p) => new AMap.LngLat(p.lng, p.lat))
        driving.search(
          new AMap.LngLat(origin.lng, origin.lat),
          new AMap.LngLat(dest.lng, dest.lat),
          { waypoints },
          onSearchDone,
        )
      }
    })
  }, [drivingRoutePoints, isLoading])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || isLoading) return
    const AMap = window.AMap
    if (!AMap) return

    if (drivingRoutePoints && drivingRoutePoints.length >= 2) {
      setResolvedPolylines(null)
      return
    }

    const needStraightSegments = polylines
      .map((pl, i) => ({ pl, i }))
      .filter(({ pl }) => pl.path.length === 2)

    if (needStraightSegments.length === 0) {
      setResolvedPolylines(null)
      return
    }

    const gen = ++routeResolveGen.current

    const tryWalking = (
      start: Coordinate,
      end: Coordinate,
      onDone: (path: Coordinate[] | null) => void,
    ) => {
      const walking = new AMap.Walking({ map: null, hideMarkers: true })
      walking.search(
        new AMap.LngLat(start.lng, start.lat),
        new AMap.LngLat(end.lng, end.lat),
        (wStatus: string, wResult: any) => {
          if (gen !== routeResolveGen.current) return
          const wr = wResult?.routes?.[0] ?? wResult?.route
          if (wStatus === "complete" && wr) {
            const path = extractPathFromRoute(wr)
            onDone(path.length >= 2 ? path : null)
          } else {
            onDone(null)
          }
        },
      )
    }

    const runDrivingThenWalking = (
      start: Coordinate,
      end: Coordinate,
      onDone: (path: Coordinate[] | null) => void,
    ) => {
      const driving = new AMap.Driving({
        map: null,
        hideMarkers: true,
        showTraffic: false,
      })
      driving.search(
        new AMap.LngLat(start.lng, start.lat),
        new AMap.LngLat(end.lng, end.lat),
        (status: string, result: any) => {
          if (gen !== routeResolveGen.current) return
          const dr = result?.routes?.[0] ?? result?.route
          if (status === "complete" && dr) {
            const path = extractPathFromRoute(dr)
            if (path.length >= 2) {
              onDone(path)
              return
            }
          }
          tryWalking(start, end, onDone)
        },
      )
    }

    const next: Polyline[] = polylines.map((p) => ({ ...p, path: [...p.path] }))
    let pending = needStraightSegments.length

    const onSegmentDone = () => {
      pending -= 1
      if (pending === 0 && gen === routeResolveGen.current) {
        setResolvedPolylines(next.map((p) => ({ ...p, path: [...p.path] })))
      }
    }

    AMap.plugin(["AMap.Driving", "AMap.Walking"], () => {
      if (gen !== routeResolveGen.current) return
      needStraightSegments.forEach(({ pl, i }) => {
        const [a, b] = pl.path
        runDrivingThenWalking(a, b, (path) => {
          if (gen !== routeResolveGen.current) return
          if (path && path.length >= 2) {
            next[i] = {
              ...pl,
              path,
              strokeWeight: pl.strokeWeight ?? 4,
            }
          }
          onSegmentDone()
        })
      })
    })
  }, [polylines, isLoading, drivingRoutePoints])

  const polylinesEffective = resolvedPolylines ?? polylines

  const polylinesToDraw: Polyline[] =
    drivingRoutePoints && drivingRoutePoints.length >= 2 && drivingPathResult && drivingPathResult.length >= 2
      ? [
          {
            path: drivingPathResult,
            strokeColor: routeStrokeColor,
            strokeWeight: 5,
            strokeOpacity: 0.88,
            strokeStyle: "solid",
          },
        ]
      : polylinesEffective

  // 更新标记和路线（每次 markers/polylines 变化时）
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || isLoading) return
    const AMap = window.AMap
    if (!AMap) return

    // 清除旧内容
    markersRef.current.forEach((m) => map.remove(m))
    polylinesRef.current.forEach((p) => map.remove(p))
    markersRef.current = []
    polylinesRef.current = []

    // 添加标记
    markers.forEach((marker) => {
      const hasIndex = typeof marker.index === "number"
      const markerInstance = hasIndex
        ? new AMap.Marker({
            position: [marker.position.lng, marker.position.lat],
            content: makeMarkerHTML(marker.index!, marker.color || "#1890ff", marker.type),
            anchor: "bottom-center",
            title: marker.title,
          })
        : new AMap.Marker({
            position: [marker.position.lng, marker.position.lat],
            title: marker.title,
          })

      markerInstance.on("click", () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(makeInfoWindowHTML(marker))
          infoWindowRef.current.open(map, [marker.position.lng, marker.position.lat])
        }
      })

      map.add(markerInstance)
      markersRef.current.push(markerInstance)
    })

    // 添加路线（多点驾车一条线，或分段公交/步行/直线）
    polylinesToDraw.forEach((polyline) => {
      const pl = new AMap.Polyline({
        path: polyline.path.map((c) => [c.lng, c.lat]),
        strokeColor: polyline.strokeColor || "#1890ff",
        strokeWeight: polyline.strokeWeight || 4,
        strokeOpacity: polyline.strokeOpacity || 0.8,
        strokeStyle: polyline.strokeStyle || "solid",
        strokeDasharray: polyline.strokeStyle === "dashed" ? [10, 5] : undefined,
        lineJoin: "round",
        lineCap: "round",
        showDir: polyline.strokeStyle !== "dashed", // 显示箭头方向
      })
      map.add(pl)
      polylinesRef.current.push(pl)
    })

    // 自适应缩放
    if (markers.length > 0 || polylinesToDraw.length > 0) {
      map.setFitView(null, false, [60, 60, 60, 60])
    }
  }, [markers, polylinesToDraw, isLoading])

  // 响应外部 activeIndex 变化：平移地图 + 弹出信息窗
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || activeIndex == null || isLoading) return
    const marker = markers.find((m) => m.index === activeIndex)
    if (!marker) return
    map.setCenter([marker.position.lng, marker.position.lat], true)
    map.setZoom(15, true)
    if (infoWindowRef.current) {
      infoWindowRef.current.setContent(makeInfoWindowHTML(marker))
      infoWindowRef.current.open(map, [marker.position.lng, marker.position.lat])
    }
  }, [activeIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-md ${className}`}
        style={{ height }}
      >
        <div className="text-center max-w-sm px-4">
          <p className="font-medium text-muted-foreground mb-2">{error}</p>
          <code className="block bg-background text-xs px-2 py-1 rounded mt-2">
            NEXT_PUBLIC_AMAP_KEY=your-web-js-api-key
          </code>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-md z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">正在加载地图...</p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full rounded-md" />
    </div>
  )
}
