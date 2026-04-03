"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DatePickerWithRange } from "@/components/date-range-picker"
import { Slider } from "@/components/ui/slider"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { tripAPI } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import type { DateRange } from "react-day-picker"

export default function CreateTripPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [budget, setBudget] = useState(5000)

  // 添加表单状态
  const [formData, setFormData] = useState<{
    destination: string
    dateRange: DateRange
    travelers: string
    travelStyle: string
    interests: string
  }>({
    destination: "",
    dateRange: {
      from: new Date(),
      to: new Date(new Date().setDate(new Date().getDate() + 7)),
    },
    travelers: "2",
    travelStyle: "balanced",
    interests: "",
  })

  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData({
      ...formData,
      [id]: value,
    })
  }

  // 处理选择器变化
  const handleSelectChange = (id: string, value: string) => {
    setFormData({
      ...formData,
      [id]: value,
    })
  }

  // 处理日期范围变化
  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    setFormData({
      ...formData,
      dateRange: dateRange ?? { from: new Date() },
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.dateRange.from) {
      toast({
        title: "请选择出发日期",
        description: "请补充出发日期后再生成行程",
        variant: "destructive",
      })
      return
    }

    if (!formData.destination.trim()) {
      toast({
        title: "请输入目的地",
        description: "目的地不能为空",
        variant: "destructive",
      })
      return
    }

    if (!formData.dateRange.to) {
      toast({
        title: "请选择完整日期范围",
        description: "请补充返程日期后再生成行程",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)

    try {
      // 准备API请求数据
      const tripData = {
        destination: formData.destination.trim(),
        startDate: formData.dateRange.from.toISOString().split("T")[0],
        endDate: formData.dateRange.to.toISOString().split("T")[0],
        travelers: Number.parseInt(formData.travelers),
        budget,
        travelStyle: formData.travelStyle,
        interests: formData.interests,
      }

      // 调用API创建行程
      const response = await tripAPI.createTrip(tripData)

      toast({
        title: "行程创建成功",
        description: "正在为您跳转到行程详情页",
      })

      // 跳转到行程结果页
      router.push(`/trip/result?id=${response.id}`)
    } catch (error) {
      console.error("创建行程失败:", error)
      toast({
        title: "创建行程失败",
        description: "请稍后再试",
        variant: "destructive",
      })
      setIsGenerating(false)
    }
  }

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">创建您的旅行计划</h1>
        <p className="text-muted-foreground mb-8">填写以下信息，我们将为您生成个性化的旅行计划</p>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>旅行信息</CardTitle>
              <CardDescription>请提供您的旅行基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="destination">目的地</Label>
                <Input
                  id="destination"
                  placeholder="例如：东京、巴黎、纽约"
                  required
                  value={formData.destination}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label>旅行日期</Label>
                <DatePickerWithRange
                  date={formData.dateRange}
                  setDate={handleDateRangeChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="travelers">旅行人数</Label>
                <Select value={formData.travelers} onValueChange={(value) => handleSelectChange("travelers", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择旅行人数" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1人</SelectItem>
                    <SelectItem value="2">2人</SelectItem>
                    <SelectItem value="3">3人</SelectItem>
                    <SelectItem value="4">4人</SelectItem>
                    <SelectItem value="5">5人</SelectItem>
                    <SelectItem value="6+">6人及以上</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>预算范围 (人民币/人)</Label>
                <div className="pt-2">
                  <Slider value={[budget]} max={20000} step={500} onValueChange={(value) => setBudget(value[0])} />
                  <div className="flex justify-between mt-2">
                    <span className="text-sm text-muted-foreground">¥1,000</span>
                    <span className="text-sm font-medium">¥{budget.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">¥20,000</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="travelStyle">旅行风格</Label>
                <Select
                  value={formData.travelStyle}
                  onValueChange={(value) => handleSelectChange("travelStyle", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择旅行风格" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relaxed">休闲放松</SelectItem>
                    <SelectItem value="balanced">平衡兼顾</SelectItem>
                    <SelectItem value="intensive">密集行程</SelectItem>
                    <SelectItem value="adventure">探险冒险</SelectItem>
                    <SelectItem value="cultural">文化体验</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interests">特别兴趣</Label>
                <Textarea
                  id="interests"
                  placeholder="请告诉我们您有什么特别的兴趣或想体验的活动（例如：美食、购物、历史、艺术等）"
                  rows={3}
                  value={formData.interests}
                  onChange={handleInputChange}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在生成行程...
                  </>
                ) : (
                  "生成行程"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  )
}
