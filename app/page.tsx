"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MapPin, Calendar, Compass, Star, MessageCircle, Sparkles, ArrowRight, Plane } from "lucide-react"

export default function Home() {
  const router = useRouter()
  return (
    <div className="w-full mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="relative py-12 md:py-24 flex flex-col items-center text-center overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">AI 驱动的智能旅行规划</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            探索世界，定制您的完美旅程
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            基于您的偏好和预算，我们的 AI 将为您生成个性化的旅行计划
          </p>
          <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <Button asChild size="lg" className="text-lg group">
              <Link href="/trip/create">
                开始规划旅程
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg">
              <Link href="/recommendations">探索推荐</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg">
              <Link href="/chat">
                <MessageCircle className="h-5 w-5 mr-2" />
                AI 助手
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* AI Assistant Highlight */}
      <section className="py-16">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-primary/20">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold mb-2">AI 智能助手</h2>
                <p className="text-muted-foreground mb-4">
                  专业的旅行规划和代码开发助手，支持实时对话、代码生成和网页预览
                </p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">旅行规划</span>
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">代码生成</span>
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">实时预览</span>
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">流式对话</span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <Button asChild size="lg" onClick={() => {
                  router.push("/chat")
                }}>
                  <Link href="/chat">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    开始对话
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <h2 className="text-3xl font-bold text-center mb-12">主要功能</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<MapPin className="h-10 w-10" />}
            title="个性化旅程"
            description="根据您的偏好、预算和时间，生成完全定制的旅行计划"
          />
          <FeatureCard
            icon={<Calendar className="h-10 w-10" />}
            title="智能行程安排"
            description="优化您的每日行程，合理安排景点游览顺序和时间"
          />
          <FeatureCard
            icon={<Compass className="h-10 w-10" />}
            title="探索推荐"
            description="发现热门景点和小众地点，基于 AI 评分系统推荐"
          />
          <FeatureCard
            icon={<Star className="h-10 w-10" />}
            title="收藏与分享"
            description="保存您喜爱的行程，与朋友分享，记录您的旅行体验"
          />
        </div>
      </section>

      {/* Popular Destinations */}
      <section className="py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-2">热门目的地</h2>
          <p className="text-muted-foreground">探索世界各地精彩的城市</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { name: "东京", emoji: "🗼", color: "from-pink-500/20 to-rose-500/20" },
            { name: "巴黎", emoji: "🗼", color: "from-blue-500/20 to-indigo-500/20" },
            { name: "纽约", emoji: "🗽", color: "from-yellow-500/20 to-orange-500/20" },
            { name: "北京", emoji: "🏯", color: "from-red-500/20 to-pink-500/20" },
            { name: "伦敦", emoji: "🇬🇧", color: "from-gray-500/20 to-slate-500/20" },
            { name: "悉尼", emoji: "🏖️", color: "from-cyan-500/20 to-blue-500/20" },
          ].map((city) => (
            <Link href={`/recommendations?city=${city.name}`} key={city.name}>
              <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group border-2 hover:border-primary/50">
                <div className={`h-48 bg-gradient-to-br ${city.color} flex items-center justify-center relative overflow-hidden`}>
                  <div className="text-6xl group-hover:scale-110 transition-transform duration-300">
                    {city.emoji}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Plane className="h-5 w-5 text-primary animate-pulse" />
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">{city.name}</h3>
                  <p className="text-muted-foreground text-sm">探索 {city.name} 的精彩行程</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Card className="p-6 flex flex-col items-center text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group border-2 hover:border-primary/50">
      <div className="mb-4 text-primary group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </Card>
  )
}
