"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Code, Plane, Send, Bot, User, Loader2, Sparkles, Download, Share2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useToast } from "@/components/ui/use-toast";

export default function ChatPage() {
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    []
  );
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const newMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsTyping(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dialogText: [...messages, newMessage],
        }),
      });

      if (!response.body) throw new Error("响应体为空");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";
      let assistantMessage = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const parsed = JSON.parse(line);
              const chunk = parsed.message?.content || "";
              assistantMessage += chunk;

              setMessages((prev) => {
                const msgs = [...prev];
                if (
                  msgs.length === 0 ||
                  msgs[msgs.length - 1].role !== "assistant"
                ) {
                  msgs.push({ role: "assistant", content: assistantMessage });
                } else {
                  // 这里覆盖，而不是 += chunk，避免重复
                  msgs[msgs.length - 1].content = assistantMessage;
                }
                return msgs;
              });
            } catch (err) {
              // JSON 不完整，跳过等待下一块
            }
          }
        }
      }
    } catch (err: any) {
      setError(err);
      toast({
        title: "发送失败",
        description: err.message || "未知错误",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  };

  // 清空聊天
  const clearChat = () => {
    setMessages([]);
    setInput("");
  };

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
  ];

  // 导出聊天记录为 markdown 文件
  const exportChat = () => {
    const content = messages
      .map((m) => `**${m.role === "user" ? "用户" : "AI助手"}:** ${m.content}`)
      .join("\n\n");
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full py-8">
      <div className="max-w-4xl mx-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 侧边栏 - 预设问题 */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">快速开始</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {presetQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3 text-left whitespace-normal break-words"
                    onClick={() => {
                      setInput(question.text);  // 只设置输入框内容，不提交
                    }}
                    disabled={isTyping}
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

          <div className="lg:col-span-3 order-1 lg:order-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
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

              <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-6">
                  {messages.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bot className="h-12 w-12 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">开始对话</h3>
                      <p>我可以帮您规划旅行、编写代码、回答问题</p>
                      <p className="text-sm mt-2">
                        请选择左侧预设问题或直接输入您的问题
                      </p>
                    </div>
                  )}

                  {messages.map((message, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                    >
                      {message.role === "assistant" && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          {/* <AvatarImage src="/ai-avatar.png" /> */}
                          <AvatarFallback>
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={`max-w-[80%] whitespace-pre-wrap ${message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-lg px-4 py-2"
                            : "bg-muted rounded-lg px-4 py-3"
                          }`}
                      >
                        {message.role === "user" ? (
                          <p>{message.content}</p>
                        ) : (
                          <MarkdownRenderer content={message.content} />
                        )}
                      </div>

                      {message.role === "user" && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          {/* <AvatarImage src="/user-avatar.png" /> */}
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex gap-3 justify-start">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src="/ai-avatar.png" />
                        <AvatarFallback>
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          AI 正在思考...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <Separator />

              <div className="p-4 flex-shrink-0">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="输入您的问题..."
                    disabled={isTyping}
                    className="flex-1"
                    autoFocus
                  />
                  <Button type="submit" disabled={isTyping || !input.trim()}>
                    {isTyping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
                {error && (
                  <p className="text-sm text-red-500 mt-2">
                    发送失败: {error.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  支持 Markdown 格式，代码块会自动高亮显示
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}