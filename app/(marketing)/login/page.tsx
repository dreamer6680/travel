"use client"

import type React from "react"
import { Suspense, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { useSearchParams } from "next/navigation"
import { useUserStore } from "@/lib/store/user-store"
import { userAPI } from "@/lib/api"

// useSearchParams 必须在 Suspense 边界内使用
function getSafeRedirect(raw: string | null, fallback: string) {
  if (!raw?.startsWith("/") || raw.startsWith("//")) return fallback
  return raw
}

function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const { login, setToken } = useUserStore()

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      await login(email, password)
      toast({ title: "登录成功", description: "欢迎回来！" })
      const redirect = getSafeRedirect(searchParams.get("redirect"), "/")
      window.location.assign(redirect)
    } catch (err: any) {
      const errorMessage = err.message || "登录失败，请检查邮箱和密码"
      setError(errorMessage)
      toast({ title: "登录失败", description: errorMessage, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("register-name") as string
    const email = formData.get("register-email") as string
    const password = formData.get("register-password") as string
    const confirmPassword = formData.get("register-confirm") as string

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致")
      setIsLoading(false)
      return
    }

    try {
      const result = await userAPI.register({ name, email, password, confirmPassword })
      if (result.token && result.user) {
        await setToken(result.token)
        toast({ title: "注册成功", description: `欢迎加入，${result.user.name}！` })
        window.location.assign("/preferences")
      } else {
        throw new Error(result.error || "注册失败")
      }
    } catch (err: any) {
      const errorMessage = err.message || "注册失败，请稍后重试"
      setError(errorMessage)
      toast({ title: "注册失败", description: errorMessage, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full flex items-center justify-center min-h-[calc(100vh-3.5rem)] py-8">
      <Tabs defaultValue="login" className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">登录</TabsTrigger>
          <TabsTrigger value="register">注册</TabsTrigger>
        </TabsList>

        {/* ── Login ── */}
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>账号登录</CardTitle>
              <CardDescription>登录您的账号以访问个性化旅行计划</CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input id="email" name="email" type="email" placeholder="your@email.com" required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">密码</Label>
                    <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                      忘记密码?
                    </Link>
                  </div>
                  <Input id="password" name="password" type="password" required disabled={isLoading} />
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

        {/* ── Register ── */}
        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>创建账号</CardTitle>
              <CardDescription>注册一个新账号以开始您的旅行规划</CardDescription>
            </CardHeader>
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="register-name">姓名</Label>
                  <Input id="register-name" name="register-name" required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">邮箱</Label>
                  <Input id="register-email" name="register-email" type="email" placeholder="your@email.com" required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">密码</Label>
                  <Input id="register-password" name="register-password" type="password" required minLength={6} disabled={isLoading} />
                  <p className="text-xs text-muted-foreground">密码长度至少 6 位</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-confirm">确认密码</Label>
                  <Input id="register-confirm" name="register-confirm" type="password" required disabled={isLoading} />
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
