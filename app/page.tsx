import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { MapPin, Calendar, Compass, Star, MessageCircle, Sparkles, Globe, Clock, Heart, ArrowRight, Zap, Shield, Users } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section - 带渐变背景 */}
      <section className="relative py-20 md:py-32 overflow-hidden bg-gradient-travel">
        {/* 装饰性背景元素 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* 徽章 */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6 hover-lift">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI 驱动的旅行规划</span>
            </div>
            
            {/* 主标题 - 使用更大胆的字体大小 */}
            <h1 className="mb-6 bg-gradient-to-r from-primary via-blue-600 to-secondary bg-clip-text text-transparent">
              探索世界，定制您的完美旅程
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              基于您的偏好和预算，我们的 AI 将为您生成个性化的旅行计划
              <br className="hidden md:block" />
              让每一次旅行都成为难忘的冒险
            </p>
            
            {/* CTA 按钮组 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="text-lg px-8 h-12 glow hover-lift">
                <Link href="/trip/create">
                  开始规划旅程
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 h-12 glass hover-lift">
                <Link href="/recommendations">
                  <Globe className="mr-2 h-5 w-5" />
                  探索推荐
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="text-lg px-8 h-12 hover-lift">
                <Link href="/chat">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  AI 助手
                </Link>
              </Button>
            </div>
            
            {/* 信任指标 */}
            <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                30 秒生成行程
              </span>
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                隐私保护
              </span>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                10,000+ 用户
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* AI Assistant Highlight - 玻璃态设计 */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="glass border-0 shadow-xl hover-lift">
            <CardContent className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center glow">
                    <Sparkles className="h-10 w-10 text-white" />
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-3xl font-bold mb-3">AI 智能助手</h2>
                  <p className="text-muted-foreground mb-6 text-lg">
                    专业的旅行规划和代码开发助手，支持实时对话、代码生成和网页预览
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <Badge>旅行规划</Badge>
                    <Badge>代码生成</Badge>
                    <Badge>实时预览</Badge>
                    <Badge>流式对话</Badge>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Button asChild size="lg" className="px-8 h-12">
                    <Link href="/chat">
                      <MessageCircle className="mr-2 h-5 w-5" />
                      开始对话
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section - 改进卡片设计 */}
      <section className="py-20 bg-gradient-travel">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">主要功能</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              一站式旅行规划工具，让出行更简单
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<MapPin className="h-8 w-8" />}
              title="个性化旅程"
              description="根据您的偏好、预算和时间，生成完全定制的旅行计划"
              color="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Calendar className="h-8 w-8" />}
              title="智能行程安排"
              description="优化您的每日行程，合理安排景点游览顺序和时间"
              color="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<Compass className="h-8 w-8" />}
              title="探索推荐"
              description="发现热门景点和小众地点，基于 AI 评分系统推荐"
              color="from-orange-500 to-red-500"
            />
            <FeatureCard
              icon={<Star className="h-8 w-8" />}
              title="收藏与分享"
              description="保存您喜爱的行程，与朋友分享，记录您的旅行体验"
              color="from-green-500 to-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Popular Destinations - 改进卡片 */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">热门目的地</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              探索全球最受欢迎的旅行城市
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {destinations.map((city) => (
              <Link href={`/recommendations?city=${city.name}`} key={city.name}>
                <DestinationCard city={city} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl">TravelAI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 TravelAI. 让旅行更美好
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode
  title: string
  description: string
  color: string
}) {
  return (
    <Card className="group hover-lift glass border-0 shadow-lg">
      <CardContent className="p-6 text-center">
        <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${color} mb-4 group-hover:scale-110 transition-transform`}>
          <div className="text-white">
            {icon}
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function DestinationCard({
  city,
}: {
  city: { name: string; description: string; image?: string }
}) {
  return (
    <Card className="overflow-hidden hover-lift group glass border-0 shadow-lg">
      <div className="h-48 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <MapPin className="h-16 w-16 text-primary/50 group-hover:scale-110 transition-transform duration-300" />
      </div>
      <CardContent className="p-5">
        <h3 className="text-2xl font-bold mb-2">{city.name}</h3>
        <p className="text-muted-foreground">{city.description}</p>
      </CardContent>
    </Card>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
      {children}
    </span>
  )
}

const destinations = [
  { name: "东京", description: "现代与传统的完美融合" },
  { name: "巴黎", description: "浪漫之都，艺术天堂" },
  { name: "纽约", description: "不夜城，世界十字路口" },
  { name: "北京", description: "千年古都，历史与现代" },
  { name: "伦敦", description: "英伦风情，文化荟萃" },
  { name: "悉尼", description: "阳光海滩，歌剧院" },
]
