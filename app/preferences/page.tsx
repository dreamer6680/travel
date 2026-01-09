"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"

export default function PreferencesPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [budget, setBudget] = useState(5000)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // 模拟保存偏好
    setTimeout(() => {
      setIsLoading(false)
      router.push("/")
    }, 1500)
  }

  return (
    <div className="w-full py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">设置您的旅行偏好</h1>
        <p className="text-muted-foreground mb-8">请告诉我们您的旅行偏好，以便我们为您提供更加个性化的旅行建议</p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-8">
            {/* 基本偏好 */}
            <Card>
              <CardHeader>
                <CardTitle>基本偏好</CardTitle>
                <CardDescription>设置您的基本旅行偏好</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="travel-style">旅行风格</Label>
                  <Select defaultValue="balanced">
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
                  <Label>预算范围 (人民币/人)</Label>
                  <div className="pt-2">
                    <Slider
                      defaultValue={[5000]}
                      max={20000}
                      step={500}
                      onValueChange={(value) => setBudget(value[0])}
                    />
                    <div className="flex justify-between mt-2">
                      <span className="text-sm text-muted-foreground">¥1,000</span>
                      <span className="text-sm font-medium">¥{budget.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">¥20,000</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>喜好的旅行季节</Label>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="spring" />
                      <label
                        htmlFor="spring"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        春季
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="summer" />
                      <label
                        htmlFor="summer"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        夏季
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="autumn" />
                      <label
                        htmlFor="autumn"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        秋季
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="winter" />
                      <label
                        htmlFor="winter"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        冬季
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 目的地偏好 */}
            <Card>
              <CardHeader>
                <CardTitle>目的地偏好</CardTitle>
                <CardDescription>告诉我们您喜欢的目的地类型</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>喜好的目的地类型</Label>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="city" />
                      <label
                        htmlFor="city"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        城市观光
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="beach" />
                      <label
                        htmlFor="beach"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        海滩度假
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="mountain" />
                      <label
                        htmlFor="mountain"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        山地徒步
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="historical" />
                      <label
                        htmlFor="historical"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        历史文化
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="food" />
                      <label
                        htmlFor="food"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        美食之旅
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="shopping" />
                      <label
                        htmlFor="shopping"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        购物天堂
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="favorite-cities">喜好的城市</Label>
                  <Input id="favorite-cities" placeholder="例如：东京、巴黎、纽约（用逗号分隔）" />
                </div>
              </CardContent>
            </Card>

            {/* 活动偏好 */}
            <Card>
              <CardHeader>
                <CardTitle>活动偏好</CardTitle>
                <CardDescription>选择您喜欢的旅行活动</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>喜好的活动类型</Label>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="museums" />
                      <label
                        htmlFor="museums"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        博物馆/美术馆
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="outdoor" />
                      <label
                        htmlFor="outdoor"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        户外活动
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="nightlife" />
                      <label
                        htmlFor="nightlife"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        夜生活
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="local-experience" />
                      <label
                        htmlFor="local-experience"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        当地体验
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="theme-parks" />
                      <label
                        htmlFor="theme-parks"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        主题公园
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="festivals" />
                      <label
                        htmlFor="festivals"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        节日/活动
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "保存中..." : "保存偏好"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </form>
      </div>
    </div>
  )
}
