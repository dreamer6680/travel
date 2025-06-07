"use client"

import type React from "react"
import { useRef, useEffect } from "react"
import { useChat } from "ai/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Send, Bot, User, Trash2, Download, Share2, Loader2, Sparkles, Code, MapPin, Plane } from "lucide-react"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { useToast } from "@/components/ui/use-toast"

export default function ChatPage() {
  const { toast } = useToast()
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, reload, stop } = useChat({
    api: "/api/chat",
    onError: (error) => {
      toast({
        title: "发送失败",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // 自动滚动到底部
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  // 清空聊天记录
  const clearChat = () => {
    window.location.reload()
  }

  // 导出聊天记录
  const exportChat = () => {
    const chatContent = messages.map((m) => `**${m.role === "user" ? "用户" : "AI助手"}**: ${m.content}`).join("\n\n")

    const blob = new Blob([chatContent], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `chat-${new Date().toISOString().split("T")[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 处理预设问题点击
  const handlePresetClick = (questionText: string) => {
    if (isLoading) return

    // 创建一个模拟的事件对象
    const syntheticEvent = {
      preventDefault: () => {},
      target: { value: questionText },
    } as React.FormEvent<HTMLFormElement>

    // 设置输入值
    handleInputChange({ target: { value: questionText } } as React.ChangeEvent<HTMLInputElement>)

    // 延迟提交以确保状态更新
    setTimeout(() => {
      handleSubmit(syntheticEvent)
    }, 100)
  }

  // 预设问题
  const presetQuestions = [
    {
      icon: <MapPin className="h-4 w-4" />,
      text: "帮我规划一个3天的东京旅行行程",
      category: "旅行规划",
    },
    {
      icon: <Code className="h-4 w-4" />,
      text: "创建一个旅行景点展示的网页",
      category: "代码开发",
    },
    {
      icon: <Plane className="h-4 w-4" />,
      text: "推荐一些适合春季旅行的目的地",
      category: "旅行推荐",
    },
    {
      icon: <Code className="h-4 w-4" />,
      text: "用React创建一个旅行日程表组件",
      category: "代码开发",
    },
  ]

  return (
    <div className="container py-8">
      <div className="max-w-7xl mx-auto">
        {/* 页面头部 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              AI 智能助手
            </h1>
            <p className="text-muted-foreground">专业的旅行规划和代码开发助手，支持实时对话和代码预览</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportChat} disabled={messages.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button variant="outline" size="sm" disabled={messages.length === 0}>
              <Share2 className="h-4 w-4 mr-2" />
              分享
            </Button>
            <Button variant="outline" size="sm" onClick={clearChat} disabled={messages.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              清空
            </Button>
          </div>
        </div>

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧边栏 - 预设问题 */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">快速开始</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {presetQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3 text-left"
                    onClick={() => handlePresetClick(question.text)}
                    disabled={isLoading}
                  >
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2">
                        {question.icon}
                        <Badge variant="outline" className="text-xs">
                          {question.category}
                        </Badge>
                      </div>
                      <span className="text-sm">{question.text}</span>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 右侧主聊天区域 */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <Card className="h-[700px] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <span className="font-medium">AI 助手</span>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">在线</span>
                    </div>
                  </div>
                  <Badge variant="secondary">{messages.length} 条消息</Badge>
                </div>
              </CardHeader>

              <Separator />

              {/* 消息列表 */}
              <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-6">
                  {messages.length === 0 && (
                    <div className="text-center py-12">
                      <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">开始对话</h3>
                      <p className="text-muted-foreground mb-4">我可以帮您规划旅行、编写代码、回答问题</p>
                      <p className="text-sm text-muted-foreground">选择左侧的快速问题或直接输入您的问题</p>
                    </div>
                  )}

                  {messages.map((message, index) => (
                    <div
                      key={message.id || index}
                      className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback>
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={`max-w-[80%] ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-lg px-4 py-2"
                            : "bg-muted rounded-lg px-4 py-3"
                        }`}
                      >
                        {message.role === "user" ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <MarkdownRenderer content={message.content} />
                        )}
                      </div>

                      {message.role === "user" && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}

                  {/* 正在输入指示器 */}
                  {isLoading && (
                    <div className="flex gap-3 justify-start">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback>
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">AI 正在思考...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <Separator />

              {/* 输入区域 */}
              <div className="p-4 flex-shrink-0">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="输入您的问题..."
                    disabled={isLoading}
                    className="flex-1"
                    autoFocus
                  />
                  <Button type="submit" disabled={isLoading || !input.trim()}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>

                {error && <p className="text-sm text-red-500 mt-2">发送失败: {error.message}</p>}

                <p className="text-xs text-muted-foreground mt-2">支持 Markdown 格式，代码块会自动高亮显示</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
