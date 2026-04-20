"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

/**
 * 日志开关：`NEXT_PUBLIC_TRIP_MAP_DEBUG=0` 强制关闭；
 * `=1` 或开发环境默认开启；生产环境仅 `=1` 时打印。
 */
function tripMapLog(step: string, detail?: Record<string, unknown>) {
  if (process.env.NEXT_PUBLIC_TRIP_MAP_DEBUG === "0") return
  const enabled =
    process.env.NEXT_PUBLIC_TRIP_MAP_DEBUG === "1" ||
    process.env.NODE_ENV === "development"
  if (!enabled) return
  if (detail !== undefined) {
    console.log(`[TripMap] ${step}`, detail)
  } else {
    console.log(`[TripMap] ${step}`)
  }
}

/** 与 init 一致：在调用路径规划类服务前再写一次，避免 StrictMode / 热更新后丢失 */
function applyAmapSecurityJsCode(): boolean {
  const sec = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE
  if (!sec || typeof window === "undefined") return false
  ;(window as unknown as { _AMapSecurityConfig?: { securityJsCode: string } })._AMapSecurityConfig = {
    securityJsCode: sec,
  }
  return true
}

/** 从 AMap 服务回调 result 上尽量抠出可读错误信息（不同插件字段名不一致） */
function summarizeAmapServiceResult(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object") {
    return { raw: String(result) }
  }
  const r = result as Record<string, unknown>
  const out: Record<string, unknown> = { keys: Object.keys(r).slice(0, 30) }
  for (const k of ["info", "errmsg", "errMsg", "message", "state", "status", "infocode", "result"]) {
    if (r[k] !== undefined) {
      const v = r[k]
      out[k] =
        typeof v === "object" && v !== null
          ? JSON.stringify(v).slice(0, 400)
          : String(v).slice(0, 400)
    }
  }
  return out
}

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

/** 公交换乘方案 polyline：字符串 "lng,lat;..." 或点数组 → { lat, lng }[] */
function normalizeTransferPathInput(p: unknown): Coordinate[] {
  const out: Coordinate[] = []
  if (p == null) return out
  if (typeof p === "string") {
    for (const s of p.split(";")) {
      const a = s.split(",")
      if (a.length < 2) continue
      const lng = Number(a[0])
      const lat = Number(a[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      out.push({ lng, lat })
    }
    return out
  }
  if (!Array.isArray(p)) return out
  for (const item of p) {
    if (!item) continue
    if (typeof (item as any).lng === "number" && typeof (item as any).lat === "number") {
      out.push({ lng: (item as any).lng, lat: (item as any).lat })
    } else if (typeof (item as any).getLng === "function" && typeof (item as any).getLat === "function") {
      out.push({ lng: (item as any).getLng(), lat: (item as any).getLat() })
    } else if (Array.isArray(item) && item.length >= 2) {
      const lng = Number(item[0])
      const lat = Number(item[1])
      if (Number.isFinite(lng) && Number.isFinite(lat)) out.push({ lng, lat })
    }
  }
  return out
}

/** 从 AMap LngLat 对象或普通坐标对象中提取单个坐标 */
function extractSingleCoord(loc: unknown): Coordinate | null {
  if (!loc || typeof loc !== "object") return null
  const l = loc as any
  if (typeof l.getLng === "function" && typeof l.getLat === "function") {
    return { lng: l.getLng(), lat: l.getLat() }
  }
  if (typeof l.lng === "number" && typeof l.lat === "number") {
    return { lng: l.lng, lat: l.lat }
  }
  return null
}

/**
 * AMap.Transfer 返回的 plan → 单段完整路径（与 1.html flattenPlanToPath 一致）
 *
 * AMap JS SDK 的 Transfer plan 结构：
 *   plan.segments[i]
 *     - transit_mode: "WALK" | "BUS" | "SUBWAY" | ...
 *     - walking: { steps: [{ path: LngLat[] }], path?: LngLat[] }   ← 步行段
 *     - transit: {
 *         lines: [{ path?: LngLat[] }],
 *         on_station:  { location: LngLat },
 *         off_station: { location: LngLat },
 *       }                                                             ← 公交/地铁段
 *
 * 注意：公交/地铁段 line.path 在 JS SDK 里通常为空，
 *       所以用 on_station/off_station 坐标作为途经点兜底，
 *       能让折线沿途经站而非直接连端点。
 */
function flattenTransferPlanToCoords(plan: any): Coordinate[] {
  const coords: Coordinate[] = []
  if (!plan) return coords

  // 顶层 path（部分版本直接有）
  if (plan.path) {
    const whole = normalizeTransferPathInput(plan.path)
    if (whole.length >= 2) return whole
  }

  const segments = plan.segments
  if (!Array.isArray(segments) || !segments.length) return coords

  for (const seg of segments) {
    // ── 步行段路径（walking 与 transit 互不依赖，独立提取）────────────────
    const walking = seg?.walking
    if (walking) {
      // 部分版本直接有 walking.path
      if (walking.path) coords.push(...normalizeTransferPathInput(walking.path))
      // 更常见：walking.steps[i].path
      if (Array.isArray(walking.steps)) {
        for (const step of walking.steps) {
          if (step?.path) coords.push(...normalizeTransferPathInput(step.path))
        }
      }
    }

    // ── 公交 / 地铁段路径 ───────────────────────────────────────────────
    const t = seg?.transit
    if (!t) continue  // 纯步行段已在上方处理，跳过

    // line.path（JS SDK 里通常为空，但有就取）
    if (t.path) coords.push(...normalizeTransferPathInput(t.path))
    if (Array.isArray(t.lines)) {
      for (const line of t.lines) {
        if (line?.path) coords.push(...normalizeTransferPathInput(line.path))
      }
    }
    if (Array.isArray(t.steps)) {
      for (const step of t.steps) {
        if (step?.path) coords.push(...normalizeTransferPathInput(step.path))
      }
    }

    // 兜底：用上/下车站坐标作为途经点，避免直线穿越
    const onCoord = extractSingleCoord(t.on_station?.location)
    const offCoord = extractSingleCoord(t.off_station?.location)
    if (onCoord) coords.push(onCoord)
    if (offCoord) coords.push(offCoord)
  }

  return coords
}

const TRANSIT_LEG_COLORS = ["#1677ff", "#13c2c2", "#722ed1", "#fa8c16", "#52c41a"]

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
  /**
   * 与 `transitCity` 同时传入且点数≥2 时：按相邻点**分段**调用 `AMap.Transfer`（公交/地铁/步行），
   * 与 `1.html` 一致；优先级高于 `drivingRoutePoints`。规划完成前仍展示 `polylines` 作为占位。
   */
  transitStops?: Coordinate[]
  /** 公交换乘规划城市名，如「上海」 */
  transitCity?: string
}

declare global {
  interface Window {
    AMap: any
  }
}

/** 活动类型 → emoji 图标（from 字段 + 中文兼容） */
const TYPE_EMOJI: Record<string, string> = {
  recommendation: "🏛️",
  restaurant: "🍜",
  hotel: "🏨",
  others: "📍",
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
  transitStops,
  transitCity,
}: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const AMapRef = useRef<any>(null)
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
  /** 分段公交换乘（每相邻两点一条线），优先于驾车线 */
  const [transitLegPolylines, setTransitLegPolylines] = useState<Polyline[] | null>(null)
  const transitLegGen = useRef(0)

  // 初始化地图（只执行一次）
  useEffect(() => {
    if (!mapRef.current || isInitialized.current) return
    isInitialized.current = true

    const loadMap = async () => {
      try {
        tripMapLog("init: 开始加载地图 SDK", { center: { lat: center.lat, lng: center.lng }, zoom })
        setIsLoading(true)
        setError(null)

        const apiKey = process.env.NEXT_PUBLIC_AMAP_KEY
        if (!apiKey) throw new Error("NEXT_PUBLIC_AMAP_KEY 未配置")

        applyAmapSecurityJsCode()

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
            "AMap.Transfer",
          ],
        })

        const map = new AMap.Map(mapRef.current, {
          viewMode: "2D",
          zoom,
          center: [center.lng, center.lat],
          mapStyle: "amap://styles/normal",
        })
        mapInstanceRef.current = map
        AMapRef.current = AMap

        // 共享信息窗口
        infoWindowRef.current = new AMap.InfoWindow({
          isCustom: true,
          autoMove: true,
          offset: new AMap.Pixel(0, -40),
        })

        setIsLoading(false)
        tripMapLog("init: 地图创建完成", {
          isLoading: false,
          securityJsCodeConfigured: !!process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE,
        })
      } catch (err: any) {
        let msg = "地图加载失败"
        if (err?.message?.includes("USERKEY_PLAT")) msg = "API Key 平台类型不匹配（需要 Web JS API 类型）"
        else if (err?.message?.includes("INVALID")) msg = "API Key 无效"
        else if (err?.message?.includes("NEXT_PUBLIC_AMAP_KEY")) msg = "API Key 未配置"
        tripMapLog("init: 失败", { message: msg, raw: String(err?.message ?? err) })
        setError(msg)
        setIsLoading(false)
      }
    }

    loadMap()
    return () => {
      tripMapLog("init: 卸载地图")
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
        AMapRef.current = null
        isInitialized.current = false
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 同步 props → 先展示直线，再异步替换为驾车/步行真实路径
  useEffect(() => {
    tripMapLog("polylines props 变化，清空 resolvedPolylines", {
      polylinesCount: polylines.length,
      firstPathLen: polylines[0]?.path?.length,
    })
    setResolvedPolylines(null)
  }, [polylines])

  // 分段公交换乘：相邻活动点之间各调一次 AMap.Transfer（参考 1.html）
  useEffect(() => {
    const city = (transitCity || "").trim()
    const stops = transitStops
    if (!stops || stops.length < 2 || !city || isLoading) {
      tripMapLog("Transfer effect: 跳过", {
        reason: !stops
          ? "无 transitStops"
          : stops.length < 2
            ? "点数<2"
            : !city
              ? "无 transitCity"
              : "isLoading=true",
        stopsLen: stops?.length ?? 0,
        city: city || "(空)",
        isLoading,
      })
      setTransitLegPolylines(null)
      return
    }
    const AMap = AMapRef.current || window.AMap
    if (!AMap) {
      tripMapLog("Transfer effect: 跳过 — AMap 未就绪")
      return
    }

    const gen = ++transitLegGen.current
    const securityApplied = applyAmapSecurityJsCode()
    tripMapLog("Transfer effect: 开始分段规划", {
      gen,
      city,
      legCount: stops.length - 1,
      stopsPreview: stops.slice(0, 4).map((p) => ({ lat: p.lat, lng: p.lng })),
      securityJsCodeConfigured: securityApplied,
    })
    if (!securityApplied) {
      tripMapLog(
        "Transfer effect: 警告 — 未配置 NEXT_PUBLIC_AMAP_SECURITY_JS_CODE，Transfer 通常会返回 status=error；请与 1.html 中 _AMapSecurityConfig 一致配置",
      )
    }
    setTransitLegPolylines(null)

    const built: Polyline[] = []
    const legOutcomes: Array<{
      legIndex: number
      status: string
      pathCoordCount: number
      usedFallback: boolean
    }> = []

    AMap.plugin(["AMap.Transfer"], () => {
      if (gen !== transitLegGen.current) {
        tripMapLog("Transfer: plugin 回调已过期，忽略", { gen, current: transitLegGen.current })
        return
      }

      applyAmapSecurityJsCode()

      const policy =
        AMap.TransferPolicy && AMap.TransferPolicy.LEAST_TIME !== undefined
          ? AMap.TransferPolicy.LEAST_TIME
          : 0

      const transfer = new AMap.Transfer({
        map: null,
        city,
        hideMarkers: true,
        policy,
      })

      const runLeg = (index: number) => {
        if (gen !== transitLegGen.current) return
        if (index >= stops.length - 1) {
          const anyRealPath = legOutcomes.some(
            (o) => o.status === "complete" && o.pathCoordCount >= 2,
          )
          tripMapLog("Transfer: 全部分段完成", {
            gen,
            builtLegs: built.length,
            eachPointCount: built.map((b) => b.path.length),
            legOutcomes,
            anyRealPath,
          })
          if (built.length > 0 && !anyRealPath) {
            tripMapLog(
              "Transfer: 所有分段均未拿到有效路径（多为 Key 未配安全密钥或服务未开通），放弃 transitLegs，回退父组件 polylines",
              {
                legOutcomes,
                hint: "配置 NEXT_PUBLIC_AMAP_SECURITY_JS_CODE；控制台 Key 勾选「Web端(JS API)」并开通路径规划/公交换乘",
              },
            )
            setTransitLegPolylines(null)
            return
          }
          if (built.length > 0) {
            setTransitLegPolylines(built.map((p) => ({ ...p, path: [...p.path] })))
          }
          return
        }

        const start = stops[index]
        const end = stops[index + 1]
        const fallbackPath = [start, end]
        const color = TRANSIT_LEG_COLORS[index % TRANSIT_LEG_COLORS.length]

        tripMapLog(`Transfer: 请求第 ${index + 1}/${stops.length - 1} 段`, {
          from: { lat: start.lat, lng: start.lng },
          to: { lat: end.lat, lng: end.lng },
          color,
        })

        transfer.search(
          new AMap.LngLat(start.lng, start.lat),
          new AMap.LngLat(end.lng, end.lat),
          (status: string, result: any) => {
            if (gen !== transitLegGen.current) {
              tripMapLog(`Transfer: 第${index + 1}段回调已过期`, { gen, current: transitLegGen.current })
              return
            }
            const plan =
              status === "complete" && result?.plans?.[0] ? result.plans[0] : null
            const pathCoords = flattenTransferPlanToCoords(plan)
            const usedFallback = pathCoords.length < 2

            legOutcomes.push({
              legIndex: index + 1,
              status,
              pathCoordCount: pathCoords.length,
              usedFallback,
            })

            tripMapLog(`Transfer: 第${index + 1}段 回调`, {
              status,
              hasPlans: !!result?.plans?.length,
              segmentCount: plan?.segments?.length ?? 0,
              pathCoordCount: pathCoords.length,
              usedFallback,
              resultSummary: summarizeAmapServiceResult(result),
            })
            if (status !== "complete") {
              tripMapLog(`Transfer: 第${index + 1}段 失败详情`, summarizeAmapServiceResult(result))
            }

            const path = pathCoords.length >= 2 ? pathCoords : fallbackPath
            built.push({
              path,
              strokeColor: color,
              strokeWeight: pathCoords.length >= 2 ? 6 : 3,
              strokeOpacity: 0.9,
              strokeStyle: "solid",
            })
            runLeg(index + 1)
          },
        )
      }

      runLeg(0)
    })
  }, [transitStops, transitCity, isLoading])

  // 多点一条驾车线（与高德示例：起点、终点、waypoints 途经点）
  useEffect(() => {
    const useTransit = !!(transitStops && transitStops.length >= 2 && (transitCity || "").trim())
    if (useTransit) {
      tripMapLog("Driving effect: 跳过（已启用 Transit）")
      setDrivingPathResult(null)
      return
    }
    if (!drivingRoutePoints || drivingRoutePoints.length < 2 || isLoading) {
      tripMapLog("Driving effect: 跳过", {
        hasPoints: !!drivingRoutePoints && drivingRoutePoints.length >= 2,
        pointCount: drivingRoutePoints?.length ?? 0,
        isLoading,
      })
      setDrivingPathResult(null)
      return
    }
    const map = mapInstanceRef.current
    const AMap = AMapRef.current || window.AMap
    if (!map || !AMap) {
      tripMapLog("Driving effect: 跳过 — map 或 AMap 未就绪")
      return
    }

    const gen = ++drivingPathGen.current
    tripMapLog("Driving effect: 开始整条驾车规划", { gen, pointCount: drivingRoutePoints.length })
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
          tripMapLog("Driving: 回调失败", { status, gen })
          setDrivingPathResult(null)
          return
        }
        const dr = result?.routes?.[0] ?? result?.route
        const path = extractPathFromRoute(dr)
        tripMapLog("Driving: 回调成功", { pathPointCount: path.length, gen })
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
  }, [drivingRoutePoints, isLoading, transitStops, transitCity])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || isLoading) {
      tripMapLog("RouteResolve effect: 跳过", { hasMap: !!map, isLoading })
      return
    }
    const AMap = AMapRef.current || window.AMap
    if (!AMap) {
      tripMapLog("RouteResolve effect: 跳过 — 无 AMap")
      return
    }

    const useTransit = !!(transitStops && transitStops.length >= 2 && (transitCity || "").trim())
    if (useTransit || (drivingRoutePoints && drivingRoutePoints.length >= 2)) {
      tripMapLog("RouteResolve effect: 跳过（Transit 或 Driving 已接管）", {
        useTransit,
        drivingPointCount: drivingRoutePoints?.length ?? 0,
      })
      setResolvedPolylines(null)
      return
    }

    const needStraightSegments = polylines
      .map((pl, i) => ({ pl, i }))
      .filter(({ pl }) => pl.path.length === 2)

    if (needStraightSegments.length === 0) {
      tripMapLog("RouteResolve effect: 无需处理（无两点直线段）", {
        polylinesCount: polylines.length,
      })
      setResolvedPolylines(null)
      return
    }

    const gen = ++routeResolveGen.current
    tripMapLog("RouteResolve effect: 开始 Driving→Walking 补全直线段", {
      gen,
      segmentCount: needStraightSegments.length,
    })

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
            tripMapLog("RouteResolve: Walking 回调", { wStatus, pathLen: path.length, gen })
            onDone(path.length >= 2 ? path : null)
          } else {
            tripMapLog("RouteResolve: Walking 无路径", { wStatus, gen })
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
              tripMapLog("RouteResolve: Driving 成功", { pathLen: path.length, gen })
              onDone(path)
              return
            }
          }
          tripMapLog("RouteResolve: Driving 失败，尝试 Walking", { status, gen })
          tryWalking(start, end, onDone)
        },
      )
    }

    const next: Polyline[] = polylines.map((p) => ({ ...p, path: [...p.path] }))
    let pending = needStraightSegments.length

    const onSegmentDone = () => {
      pending -= 1
      tripMapLog("RouteResolve: 一段完成", { pending, gen })
      if (pending === 0 && gen === routeResolveGen.current) {
        tripMapLog("RouteResolve: 全部直线段补全完成", { gen })
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
  }, [polylines, isLoading, drivingRoutePoints, transitStops, transitCity])

  const polylinesEffective = resolvedPolylines ?? polylines

  const useTransitLegs =
    !!(transitStops && transitStops.length >= 2 && (transitCity || "").trim() && transitLegPolylines?.length)

  const polylinesToDraw: Polyline[] = useTransitLegs
    ? transitLegPolylines!
    : drivingRoutePoints &&
        drivingRoutePoints.length >= 2 &&
        drivingPathResult &&
        drivingPathResult.length >= 2
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
    if (!map || isLoading) {
      tripMapLog("draw effect: 跳过", { hasMap: !!map, isLoading })
      return
    }
    const AMap = AMapRef.current || window.AMap
    if (!AMap) {
      tripMapLog("draw effect: 跳过 — 无 AMap")
      return
    }

    tripMapLog("draw effect: 重绘标记与折线", {
      markerCount: markers.length,
      polylineCount: polylinesToDraw.length,
      drawMode: useTransitLegs
        ? "transitLegs"
        : drivingRoutePoints &&
            drivingRoutePoints.length >= 2 &&
            drivingPathResult &&
            drivingPathResult.length >= 2
          ? "drivingSingle"
          : "polylinesEffective",
      pointCounts: polylinesToDraw.map((p) => p.path.length),
      transitLegStateCount: transitLegPolylines?.length ?? 0,
      hasResolvedOverlay: resolvedPolylines !== null,
    })

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
      tripMapLog("draw effect: setFitView 已调用")
    }
  }, [markers, polylinesToDraw, isLoading])

  // 响应外部 activeIndex 变化：平移地图 + 弹出信息窗
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || activeIndex == null || isLoading) return
    const AMap = AMapRef.current || window.AMap
    if (!AMap) return
    const marker = markers.find((m) => m.index === activeIndex)
    if (!marker) {
      tripMapLog("activeIndex: 未找到对应 marker", { activeIndex })
      return
    }
    tripMapLog("activeIndex: 聚焦标记", { activeIndex, title: marker.title })
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
