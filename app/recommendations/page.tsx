"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Heart, Search, Star, MapPin, Filter, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { recommendationAPI } from "@/lib/api"
import Image from "next/image"

// 定义景点类型
interface Attraction {
  id: number
  name: string
  location: string
  rating: number
  type: string
  description: string
  imageUrl?: string
  likes: number
}

export default function RecommendationsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [favorites, setFavorites] = useState<number[]>([])
  const [selectedType, setSelectedType] = useState("all")

  // 添加状态管理API数据
  const [popularAttractions, setPopularAttractions] = useState<Attraction[]>([])
  const [hiddenGems, setHiddenGems] = useState<Attraction[]>([])
  const [aiRecommendations, setAiRecommendations] = useState<Attraction[]>([])

  // 添加加载状态
  const [isLoadingPopular, setIsLoadingPopular] = useState(true)
  const [isLoadingHidden, setIsLoadingHidden] = useState(true)
  const [isLoadingAI, setIsLoadingAI] = useState(true)

  // 添加错误状态
  const [error, setError] = useState<string | null>(null)

  // 获取热门景点
  useEffect(() => {
    async function fetchPopularAttractions() {
      try {
        setIsLoadingPopular(true)
        const data = await recommendationAPI.getPopularAttractions()
        setPopularAttractions(data)
      } catch (err) {
        console.error("获取热门景点失败:", err)
        setError("获取热门景点失败，请稍后再试")
      } finally {
        setIsLoadingPopular(false)
      }
    }

    fetchPopularAttractions()
  }, [])

  // 获取小众景点
  useEffect(() => {
    async function fetchHiddenGems() {
      try {
        setIsLoadingHidden(true)
        const data = await recommendationAPI.getHiddenGems()
        setHiddenGems(data)
      } catch (err) {
        console.error("获取小众景点失败:", err)
        setError("获取小众景点失败，请稍后再试")
      } finally {
        setIsLoadingHidden(false)
      }
    }

    fetchHiddenGems()
  }, [])

  // 获取AI推荐
  useEffect(() => {
    async function fetchAIRecommendations() {
      try {
        setIsLoadingAI(true)
        const data = await recommendationAPI.getAIRecommendations()
        setAiRecommendations(data)
      } catch (err) {
        console.error("获取AI推荐失败:", err)
        setError("获取AI推荐失败，请稍后再试")
      } finally {
        setIsLoadingAI(false)
      }
    }

    fetchAIRecommendations()
  }, [])

  const toggleFavorite = (id: number) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter((item) => item !== id))
    } else {
      setFavorites([...favorites, id])
    }
  }

  // 根据类型筛选景点
  const filterByType = (attractions: Attraction[]) => {
    if (selectedType === "all") return attractions
    return attractions.filter((attraction) => attraction.type === selectedType)
  }

  // 根据搜索关键词筛选景点
  const filterBySearch = (attractions: Attraction[]) => {
    if (!searchQuery.trim()) return attractions
    const query = searchQuery.toLowerCase()
    return attractions.filter(
      (attraction) =>
        attraction.name.toLowerCase().includes(query) ||
        attraction.location.toLowerCase().includes(query) ||
        attraction.description.toLowerCase().includes(query),
    )
  }

  // 应用所有筛选条件
  const filteredPopular = filterBySearch(filterByType(popularAttractions))
  const filteredHidden = filterBySearch(filterByType(hiddenGems))
  const filteredAI = filterBySearch(filterByType(aiRecommendations))

  return (
    <div className="w-full py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">探索推荐</h1>
          <p className="text-muted-foreground mb-6">发现世界各地的精彩景点，从热门地标到小众宝藏</p>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索景点、城市或国家..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有类型</SelectItem>
                  <SelectItem value="观景台">观景台</SelectItem>
                  <SelectItem value="博物馆">博物馆</SelectItem>
                  <SelectItem value="自然景观">自然景观</SelectItem>
                  <SelectItem value="历史建筑">历史建筑</SelectItem>
                  <SelectItem value="艺术展览">艺术展览</SelectItem>
                  <SelectItem value="公园">公园</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

        <Tabs defaultValue="popular" className="mb-8">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="popular">热门景点</TabsTrigger>
            <TabsTrigger value="hidden">小众推荐</TabsTrigger>
            <TabsTrigger value="ai">AI 推荐</TabsTrigger>
          </TabsList>

          <TabsContent value="popular">
            {isLoadingPopular ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">加载中...</span>
              </div>
            ) : filteredPopular.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPopular.map((attraction) => (
                  <AttractionCard
                    key={attraction.id}
                    attraction={attraction}
                    isFavorite={favorites.includes(attraction.id)}
                    onToggleFavorite={() => toggleFavorite(attraction.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">没有找到符合条件的景点</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="hidden">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-2">小众宝藏</h2>
              <p className="text-muted-foreground">基于 AI 评分发现的隐藏景点</p>
            </div>
            {isLoadingHidden ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">加载中...</span>
              </div>
            ) : filteredHidden.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHidden.map((attraction) => (
                  <AttractionCard
                    key={attraction.id}
                    attraction={attraction}
                    isFavorite={favorites.includes(attraction.id)}
                    onToggleFavorite={() => toggleFavorite(attraction.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">没有找到符合条件的景点</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ai">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-2">个性化推荐</h2>
              <p className="text-muted-foreground">根据您的偏好和历史记录推荐</p>
            </div>
            {isLoadingAI ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">加载中...</span>
              </div>
            ) : filteredAI.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAI.map((attraction) => (
                  <AttractionCard
                    key={attraction.id}
                    attraction={attraction}
                    isFavorite={favorites.includes(attraction.id)}
                    onToggleFavorite={() => toggleFavorite(attraction.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">没有找到符合条件的景点</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function AttractionCard({
  attraction,
  isFavorite,
  onToggleFavorite,
}: {
  attraction: Attraction
  isFavorite: boolean
  onToggleFavorite: () => void
}) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-48 bg-muted flex items-center justify-center">
        {attraction.imageUrl ? (
          <Image
            src={attraction.imageUrl || "/placeholder.svg"}
            alt={attraction.name}
            width={100}
            height={100}
            className="h-full w-full object-cover"
          />
        ) : (
          <MapPin className="h-12 w-12 text-muted-foreground" />
        )}
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{attraction.name}</CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {attraction.location}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onToggleFavorite} className="shrink-0">
              <Heart className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
            </Button>
            <span className="text-sm font-medium">{attraction.likes}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline">{attraction.type}</Badge>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{attraction.rating}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{attraction.description}</p>
        <Button className="w-full mt-4" variant="outline">
          查看详情
        </Button>
      </CardContent>
    </Card>
  )
}
