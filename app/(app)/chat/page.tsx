"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  MapPin, Plane, Send, Bot, User, Sparkles, Trash2,
  Plus, MessageSquare, Clock, ChevronLeft, ChevronRight,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { useToast } from "@/components/ui/use-toast"
import { useUserStore } from "@/lib/store/user-store"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: "user" | "assistant"
  content: string
}

interface Session {
  id: string
  title: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRESET_QUESTIONS = [
  { icon: <MapPin className="h-3.5 w-3.5" />, text: "帮我规划一个3天的东京旅行行程" },
  { icon: <Plane className="h-3.5 w-3.5" />, text: "推荐一些适合春季旅行的目的地" },
  { icon: <MapPin className="h-3.5 w-3.5" />, text: "北京有哪些值得打卡的网红景点？" },
  { icon: <Plane className="h-3.5 w-3.5" />, text: "第一次出国旅行需要注意什么？" },
]

function formatSessionDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return "今天"
  if (diffDays === 1) return "昨天"
  if (diffDays < 7) return `${diffDays} 天前`
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
}

// ---------------------------------------------------------------------------
// Thinking animation
// ---------------------------------------------------------------------------

function ThinkingDots() {
  return (
    <div className="flex gap-3 items-end">
      <Avatar className="h-7 w-7 flex-shrink-0 mb-0.5">
        <AvatarFallback className="bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </AvatarFallback>
      </Avatar>
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
            />
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground leading-none">AI 正在思考…</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChatPage() {
  const { toast } = useToast()
  const { isAuthenticated } = useUserStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  // sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)

  // ------------------------------------------------------------------
  // Auto-scroll to bottom
  // ------------------------------------------------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  // ------------------------------------------------------------------
  // Load session list on mount (if authenticated)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated) return
    setIsLoadingSessions(true)
    fetch("/api/chat/history")
      .then((r) => r.json())
      .then((data: Session[]) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setIsLoadingSessions(false))
  }, [isAuthenticated])

  // ------------------------------------------------------------------
  // Load a specific session
  // ------------------------------------------------------------------
  const loadSession = useCallback(async (session: Session) => {
    if (isTyping) return
    try {
      const res = await fetch(`/api/chat/history/${session.id}`)
      const data = await res.json()
      const msgs: Message[] = (data.messages ?? [])
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .map((m: any) => ({ role: m.role, content: m.content }))
      setMessages(msgs)
      setCurrentSessionId(session.id)
    } catch {
      toast({ title: "加载失败", variant: "destructive" })
    }
  }, [isTyping, toast])

  // ------------------------------------------------------------------
  // New conversation
  // ------------------------------------------------------------------
  const newConversation = () => {
    if (isTyping) return
    setMessages([])
    setCurrentSessionId(null)
    textareaRef.current?.focus()
  }

  // ------------------------------------------------------------------
  // Delete session
  // ------------------------------------------------------------------
  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    try {
      await fetch(`/api/chat/history/${sessionId}`, { method: "DELETE" })
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (currentSessionId === sessionId) {
        setMessages([])
        setCurrentSessionId(null)
      }
    } catch {
      toast({ title: "删除失败", variant: "destructive" })
    }
  }

  // ------------------------------------------------------------------
  // Save exchange to history
  // ------------------------------------------------------------------
  const saveExchange = useCallback(
    async (userMsg: string, assistantMsg: string, sessionId: string | null) => {
      if (!isAuthenticated) return null
      try {
        const res = await fetch("/api/chat/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            userMessage: userMsg,
            assistantMessage: assistantMsg,
          }),
        })
        const data = await res.json()
        const newId: string = data.sessionId

        if (data.isNew) {
          const title =
            userMsg.length > 40 ? userMsg.slice(0, 40) + "…" : userMsg
          setSessions((prev) => [
            { id: newId, title, updatedAt: new Date().toISOString() },
            ...prev,
          ])
        } else {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === newId ? { ...s, updatedAt: new Date().toISOString() } : s,
            ),
          )
        }

        return newId
      } catch {
        return null
      }
    },
    [isAuthenticated],
  )

  // ------------------------------------------------------------------
  // Send message
  // ------------------------------------------------------------------
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isTyping) return

    const userMsg: Message = { role: "user", content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsTyping(true)

    let assistantText = ""
    const sessionIdRef = currentSessionId // capture before async

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dialogText: [...messages, userMsg] }),
      })

      if (!response.body) throw new Error("响应体为空")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let buf = ""

      while (!done) {
        const { value, done: d } = await reader.read()
        done = d
        if (value) {
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const chunk = JSON.parse(line).message?.content ?? ""
              assistantText += chunk
              setMessages((prev) => {
                const next = [...prev]
                if (next[next.length - 1]?.role !== "assistant") {
                  next.push({ role: "assistant", content: assistantText })
                } else {
                  next[next.length - 1] = { role: "assistant", content: assistantText }
                }
                return next
              })
            } catch { /* incomplete JSON chunk */ }
          }
        }
      }
    } catch (err: any) {
      toast({ title: "发送失败", description: err.message, variant: "destructive" })
    } finally {
      setIsTyping(false)
      if (assistantText) {
        const newId = await saveExchange(text, assistantText, sessionIdRef)
        if (newId && !sessionIdRef) setCurrentSessionId(newId)
      }
    }
  }

  // Ctrl/Cmd + Enter to send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Whether the last message is streaming (no thinking bubble needed)
  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant"
  const showThinking = isTyping && !lastIsAssistant

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* ── History sidebar ── */}
      <div
        className={cn(
          "flex-shrink-0 border-r bg-muted/30 flex flex-col transition-all duration-200 overflow-hidden",
          sidebarOpen ? "w-64" : "w-0",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <span className="font-semibold text-sm">历史对话</span>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={newConversation}>
            <Plus className="h-3.5 w-3.5" />
            新建
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 py-2 space-y-0.5">
            {!isAuthenticated && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                登录后可查看历史对话
              </p>
            )}
            {isAuthenticated && sessions.length === 0 && !isLoadingSessions && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                暂无历史对话
              </p>
            )}
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => loadSession(session)}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-2.5 group flex flex-col gap-0.5 transition-colors hover:bg-muted",
                  currentSessionId === session.id && "bg-muted",
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-medium leading-snug line-clamp-2 flex-1 min-w-0">
                    {session.title}
                  </span>
                  <button
                    onClick={(e) => deleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 rounded p-0.5 hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  {formatSessionDate(session.updatedAt)}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── Chat area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center justify-between px-4 h-12 border-b flex-shrink-0 bg-background">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              {sidebarOpen ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Bot className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">AI 旅行助手</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {messages.length} 条消息
              </Badge>
            )}
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                onClick={newConversation}
                disabled={isTyping}
              >
                <Plus className="h-3.5 w-3.5" />
                新建对话
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-6">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-1">AI 旅行助手</h2>
                  <p className="text-sm text-muted-foreground">
                    帮你规划行程、发现目的地、推荐游记
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                  {PRESET_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(q.text)
                        textareaRef.current?.focus()
                      }}
                      className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm text-left
                        hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <span className="text-primary flex-shrink-0">{q.icon}</span>
                      {q.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start items-end",
                )}
              >
                {msg.role === "assistant" && (
                  <Avatar className="h-7 w-7 flex-shrink-0 mb-0.5">
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={cn(
                    "max-w-[78%]",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm"
                      : "bg-muted rounded-2xl rounded-bl-sm px-4 py-3 text-sm",
                  )}
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )}
                </div>

                {msg.role === "user" && (
                  <Avatar className="h-7 w-7 flex-shrink-0 mb-0.5">
                    <AvatarFallback className="bg-secondary">
                      <User className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {/* Thinking indicator */}
            {showThinking && <ThinkingDots />}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="flex-shrink-0 border-t bg-background px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={handleSubmit}
              className="flex gap-2 items-end rounded-2xl border bg-background px-4 py-3
                focus-within:ring-1 focus-within:ring-primary/30 transition-all shadow-sm"
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入问题，Ctrl+Enter 发送…"
                disabled={isTyping}
                rows={1}
                className="flex-1 resize-none border-0 bg-transparent p-0 focus-visible:ring-0
                  focus-visible:ring-offset-0 shadow-none text-sm min-h-[24px] max-h-[160px]"
                style={{ fieldSizing: "content" } as any}
              />
              <Button
                type="submit"
                size="sm"
                disabled={isTyping || !input.trim()}
                className="h-8 w-8 p-0 rounded-xl flex-shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
              支持 Markdown · 自动引用平台游记 · Ctrl+Enter 发送
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
