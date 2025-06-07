"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // 模拟登录请求
    setTimeout(() => {
      setIsLoading(false)
      window.location.href = "/"
    }, 1500)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // 模拟注册请求
    setTimeout(() => {
      setIsLoading(false)
      window.location.href = "/preferences"
    }, 1500)
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-8rem)] py-8">
      <Tabs defaultValue="login" className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">登录</TabsTrigger>
          <TabsTrigger value="register">注册</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>账号登录</CardTitle>
              <CardDescription>登录您的账号以访问个性化旅行计划</CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input id="email" type="email" placeholder="your@email.com" required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">密码</Label>
                    <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                      忘记密码?
                    </Link>
                  </div>
                  <Input id="password" type="password" required />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "登录中..." : "登录"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>创建账号</CardTitle>
              <CardDescription>注册一个新账号以开始您的旅行规划</CardDescription>
            </CardHeader>
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">姓名</Label>
                  <Input id="register-name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">邮箱</Label>
                  <Input id="register-email" type="email" placeholder="your@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">密码</Label>
                  <Input id="register-password" type="password" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-confirm">确认密码</Label>
                  <Input id="register-confirm" type="password" required />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "注册中..." : "注册"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
