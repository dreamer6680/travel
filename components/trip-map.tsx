"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

interface Coordinate {
  lat: number
  lng: number
}

interface Marker {
  position: Coordinate
  title: string
  content?: string
  icon?: string
}

interface Polyline {
  path: Coordinate[]
  strokeColor?: string
  strokeWeight?: number
  strokeOpacity?: number
}

interface TripMapProps {
  center?: Coordinate
  zoom?: number
  markers?: Marker[]
  polylines?: Polyline[]
  height?: string
  className?: string
}

declare global {
  interface Window {
    AMap: any
  }
}

export function TripMap({
  center = { lat: 39.9042, lng: 116.4074 }, // 默认北京
  zoom = 13,
  markers = [],
  polylines = [],
  height = "400px",
  className = "",
}: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const polylinesRef = useRef<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    const loadMap = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const apiKey = process.env.NEXT_PUBLIC_AMAP_KEY
        if (!apiKey) {
          throw new Error("NEXT_PUBLIC_AMAP_KEY 未配置")
        }

        // 动态加载高德地图 JS API
        const AMapLoader = (await import("@amap/amap-jsapi-loader")).default

        const AMap = await AMapLoader.load({
          key: apiKey,
          version: "2.0",
          plugins: ["AMap.Marker", "AMap.InfoWindow", "AMap.Polyline"],
          // 如果需要安全密钥，可以添加 securityJsCode
          // securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE,
        })

        // 创建地图实例
        const map = new AMap.Map(mapRef.current, {
          viewMode: "3D",
          zoom: zoom,
          center: [center.lng, center.lat],
        })

        mapInstanceRef.current = map

        // 添加标记
        markers.forEach((marker) => {
          const markerInstance = new AMap.Marker({
            position: [marker.position.lng, marker.position.lat],
            title: marker.title,
            icon: marker.icon
              ? new AMap.Icon({
                  image: marker.icon,
                  size: new AMap.Size(32, 32),
                })
              : undefined,
          })

          // 添加信息窗口
          if (marker.content) {
            const infoWindow = new AMap.InfoWindow({
              content: `<div style="padding: 8px;"><strong>${marker.title}</strong><br/>${marker.content}</div>`,
            })

            markerInstance.on("click", () => {
              infoWindow.open(map, markerInstance.getPosition())
            })
          }

          map.add(markerInstance)
          markersRef.current.push(markerInstance)
        })

        // 添加路线
        polylines.forEach((polyline) => {
          const polylineInstance = new AMap.Polyline({
            path: polyline.path.map((coord) => [coord.lng, coord.lat]),
            strokeColor: polyline.strokeColor || "#1890ff",
            strokeWeight: polyline.strokeWeight || 4,
            strokeOpacity: polyline.strokeOpacity || 0.8,
            lineJoin: "round",
            lineCap: "round",
          })

          map.add(polylineInstance)
          polylinesRef.current.push(polylineInstance)
        })

        // 自适应缩放
        if (markers.length > 0 || polylines.length > 0) {
          map.setFitView(null, false, [50, 50, 50, 50])
        }

        setIsLoading(false)
      } catch (err: any) {
        console.error("加载地图失败:", err)
        
        let errorMessage = "地图加载失败"
        if (err?.message?.includes("USERKEY_PLAT_NOMATCH") || err?.message?.includes("USERKEY_PLAT")) {
          errorMessage = "API Key 平台类型不匹配"
        } else if (err?.message?.includes("INVALID_USER_KEY") || err?.message?.includes("INVALID")) {
          errorMessage = "API Key 无效或未配置"
        } else if (err?.message?.includes("NEXT_PUBLIC_AMAP_KEY")) {
          errorMessage = "API Key 未配置"
        }
        
        setError(errorMessage)
        setIsLoading(false)
      }
    }

    loadMap()

    // 清理函数
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
      }
      markersRef.current = []
      polylinesRef.current = []
    }
  }, [center, zoom])

  // 更新标记和路线
  useEffect(() => {
    if (!mapInstanceRef.current || !window.AMap) return

    // 清除旧的标记和路线
    markersRef.current.forEach((marker) => {
      mapInstanceRef.current.remove(marker)
    })
    polylinesRef.current.forEach((polyline) => {
      mapInstanceRef.current.remove(polyline)
    })
    markersRef.current = []
    polylinesRef.current = []

    const AMap = window.AMap

    // 添加新标记
    markers.forEach((marker) => {
      const markerInstance = new AMap.Marker({
        position: [marker.position.lng, marker.position.lat],
        title: marker.title,
      })

      if (marker.content) {
        const infoWindow = new AMap.InfoWindow({
          content: `<div style="padding: 8px;"><strong>${marker.title}</strong><br/>${marker.content}</div>`,
        })

        markerInstance.on("click", () => {
          infoWindow.open(mapInstanceRef.current, markerInstance.getPosition())
        })
      }

      mapInstanceRef.current.add(markerInstance)
      markersRef.current.push(markerInstance)
    })

    // 添加新路线
    polylines.forEach((polyline) => {
      const polylineInstance = new AMap.Polyline({
        path: polyline.path.map((coord) => [coord.lng, coord.lat]),
        strokeColor: polyline.strokeColor || "#1890ff",
        strokeWeight: polyline.strokeWeight || 4,
        strokeOpacity: polyline.strokeOpacity || 0.8,
      })

      mapInstanceRef.current.add(polylineInstance)
      polylinesRef.current.push(polylineInstance)
    })

    // 自适应缩放
    if (markers.length > 0 || polylines.length > 0) {
      mapInstanceRef.current.setFitView(null, false, [50, 50, 50, 50])
    }
  }, [markers, polylines])

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-md ${className}`}
        style={{ height }}
      >
        <div className="text-center max-w-md px-4">
          <p className="text-muted-foreground font-medium mb-2">{error}</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>请在 .env.local 中配置：</p>
            <code className="block bg-background px-2 py-1 rounded text-xs mt-1">
              NEXT_PUBLIC_AMAP_KEY=your-web-js-api-key
            </code>
            <p className="mt-2 text-xs">
              ⚠️ 注意：需要使用 <strong>Web 端（JS API）</strong> 类型的 Key，不是 Web 服务 Key
            </p>
            <p className="text-xs mt-1">
              获取方式：<a 
                href="https://console.amap.com/dev/key/app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                高德开放平台控制台
              </a>
            </p>
          </div>
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
      <div ref={mapRef} className="w-full h-full rounded-md" style={{ minHeight: height }} />
    </div>
  )
}
