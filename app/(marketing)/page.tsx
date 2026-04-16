"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { MapPin, Calendar, Compass, Star, MessageCircle, Sparkles, ArrowRight, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import Footer from "@/components/footer"

export default function Home() {
  return (
    <div className="w-full">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-700 dark:from-sky-700 dark:via-indigo-800 dark:to-purple-900">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-pink-400/20 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-6 py-28 md:py-40 text-center text-white">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-sm backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            AI 驱动的旅行规划平台
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
            探索世界<br />
            <span className="bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
              定制完美旅程
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg md:text-xl text-white/80">
            基于您的偏好和预算，AI 为您生成专属行程——从景点到路线，一键搞定
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-white text-indigo-700 hover:bg-white/90 font-semibold px-8 text-base shadow-lg">
              <Link href="/trips">
                开始规划旅程
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/50 text-indigo-700 hover:bg-white/10 px-8 text-base">
              <Link href="/recommendations">探索推荐景点</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "10,000+", label: "精选景点" },
            { value: "50+", label: "热门城市" },
            { value: "AI 实时", label: "行程生成" },
            { value: "24 / 7", label: "智能助手" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Assistant highlight ── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
          <CardContent className="p-8 md:p-10">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">AI 智能旅行助手</h2>
                <p className="text-muted-foreground mb-5 max-w-lg">
                  专业旅行规划助手，支持实时对话、代码生成与网页预览，随时回答你关于目的地的一切问题
                </p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {["旅行规划", "行程优化", "实时预览", "流式对话", "景点推荐"].map((tag) => (
                    <span key={tag} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0">
                <Button asChild size="lg" className="shadow-md">
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

      {/* ── Features ── */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">为什么选择我们</h2>
          <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
            从计划到出发，每一步都有 AI 的支持
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              gradient="from-sky-400 to-blue-600"
              icon={<MapPin className="h-6 w-6 text-white" />}
              title="个性化旅程"
              description="根据偏好、预算和时间，生成完全定制的旅行计划"
            />
            <FeatureCard
              gradient="from-emerald-400 to-teal-600"
              icon={<Calendar className="h-6 w-6 text-white" />}
              title="智能行程安排"
              description="优化每日行程，合理安排景点游览顺序和时间"
            />
            <FeatureCard
              gradient="from-amber-400 to-orange-500"
              icon={<Compass className="h-6 w-6 text-white" />}
              title="探索推荐"
              description="发现热门景点和小众地点，基于 AI 评分系统推荐"
            />
            <FeatureCard
              gradient="from-pink-400 to-rose-600"
              icon={<Star className="h-6 w-6 text-white" />}
              title="收藏与分享"
              description="保存喜爱的行程，与朋友分享，记录旅行体验"
            />
          </div>
        </div>
      </section>

      {/* ── Popular Destinations ── */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">热门目的地</h2>
            <p className="text-muted-foreground">探索全球最受欢迎的旅行城市</p>
          </div>
          <Button asChild variant="outline" className="hidden md:flex">
            <Link href="/recommendations">
              查看全部
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {DESTINATIONS.map((dest) => (
            <DestinationCard key={dest.city} {...dest} />
          ))}
        </div>
        <div className="mt-8 text-center md:hidden">
          <Button asChild variant="outline">
            <Link href="/recommendations">查看全部目的地</Link>
          </Button>
        </div>
      </section>

      {/* ── CTA bottom banner ── */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-700">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center text-white">
          <Globe className="mx-auto h-12 w-12 mb-6 opacity-80" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">准备好出发了吗？</h2>
          <p className="text-white/80 mb-8 text-lg">
            立即注册，让 AI 帮您规划一趟难忘的旅程
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-indigo-700 hover:bg-white/90 font-semibold px-8">
              <Link href="/login">免费注册</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/50 text-yellow-500 hover:bg-white/10 px-8">
              <Link href="/recommendations">先看看景点</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FeatureCard({
  gradient,
  icon,
  title,
  description,
}: {
  gradient: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Card className="p-6 flex flex-col hover:shadow-md transition-shadow">
      <div className={cn("mb-4 w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center", gradient)}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </Card>
  )
}

const DESTINATIONS = [
  { city: "东京", tagline: "霓虹灯与枯山水的碰撞", gradient: "from-pink-500 to-rose-600", emoji: "🗼" },
  { city: "巴黎", tagline: "艺术之都，浪漫永恒", gradient: "from-violet-500 to-purple-700", emoji: "🗽" },
  { city: "纽约", tagline: "永不眠的国际都会", gradient: "from-amber-400 to-orange-600", emoji: "🏙️" },
  { city: "北京", tagline: "千年古都，现代中国", gradient: "from-red-500 to-rose-700", emoji: "🏯" },
  { city: "伦敦", tagline: "经典绅士风格与潮流碰撞", gradient: "from-teal-500 to-cyan-700", emoji: "🎡" },
  { city: "悉尼", tagline: "阳光海岸，Opera House 之约", gradient: "from-sky-400 to-blue-600", emoji: "🦭" },
]

function DestinationCard({
  city,
  tagline,
  gradient,
  emoji,
}: {
  city: string
  tagline: string
  gradient: string
  emoji: string
}) {
  return (
    <Link href={`/recommendations?city=${city}`}>
      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
        <div className={cn("h-44 bg-gradient-to-br flex flex-col items-center justify-center relative", gradient)}>
          <span className="text-6xl mb-2 drop-shadow-md group-hover:scale-110 transition-transform duration-300">
            {emoji}
          </span>
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
        </div>
        <CardContent className="p-4">
          <h3 className="text-xl font-semibold">{city}</h3>
          <p className="text-muted-foreground text-sm mt-1">{tagline}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
