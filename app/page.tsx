import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { MapPin, Calendar, Compass, Star, MessageCircle, Sparkles } from "lucide-react"

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="py-12 md:py-24 flex flex-col items-center text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">探索世界，定制您的完美旅程</h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl">
          基于您的偏好和预算，我们的 AI 将为您生成个性化的旅行计划
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg" className="text-lg">
            <Link href="/trip/create">开始规划旅程</Link>
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
                <Button asChild size="lg">
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
        <h2 className="text-3xl font-bold text-center mb-12">热门目的地</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {["东京", "巴黎", "纽约", "北京", "伦敦", "悉尼"].map((city) => (
            <Link href={`/recommendations?city=${city}`} key={city}>
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="h-48 bg-muted flex items-center justify-center">
                  <MapPin className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardContent className="p-4">
                  <h3 className="text-xl font-semibold">{city}</h3>
                  <p className="text-muted-foreground">探索 {city} 的精彩行程</p>
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
    <Card className="p-6 flex flex-col items-center text-center">
      <div className="mb-4 text-primary">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </Card>
  )
}
