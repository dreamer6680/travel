import { NextRequest } from "next/server"
import { proxyStreamToPythonAgent } from "@/server/python-agent-client"
import clientPromise from "@/lib/db"

export const runtime = "nodejs"

// ---------------------------------------------------------------------------
// Blog RAG helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

async function searchRelevantBlogs(query: string) {
  try {
    const client = await clientPromise
    const col = client.db("trip").collection("TravelBlogs")

    // Extract meaningful keywords (≥2 chars, no punctuation words)
    const words = query
      .split(/[\s，,。！？!?.、；;：:""''(（)）\-—]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2)
      .slice(0, 6)

    if (words.length === 0) return []

    const orClauses = words.flatMap((w) => [
      { title: { $regex: w, $options: "i" } },
      { destination: { $regex: w, $options: "i" } },
    ])

    const blogs = await col
      .find({ status: "published", $or: orClauses })
      .project({ id: 1, title: 1, destination: 1, content: 1, _id: 0 })
      .limit(3)
      .toArray()

    return blogs
  } catch {
    return []
  }
}

function buildBlogContext(blogs: any[]): string {
  const list = blogs
    .map((b, i) => {
      const excerpt = stripHtml(b.content || "").slice(0, 160)
      return [
        `${i + 1}. 《${b.title}》（目的地：${b.destination || "未注明"}）`,
        `   内容摘要：${excerpt}${excerpt.length >= 160 ? "…" : ""}`,
        `   引用链接格式（请原样使用，不得修改路径）：[📖 游记：${b.title}](/blogs/${b.id})`,
      ].join("\n")
    })
    .join("\n\n")

  return (
    `你是一个专业的旅行助手。以下是本平台用户发布的游记，如果它们与用户的问题相关，` +
    `请在回答中自然地引用（使用括号内的 Markdown 链接格式，保持路径不变）。\n\n` +
    `【相关游记】\n${list}`
  )
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const { dialogText } = await req.json()

  if (!dialogText || !Array.isArray(dialogText)) {
    return new Response(JSON.stringify({ error: "dialogText is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Find last user message for blog search
  const lastUserMsg =
    [...dialogText].reverse().find((m: any) => m.role === "user")?.content ?? ""

  const relatedBlogs = lastUserMsg ? await searchRelevantBlogs(lastUserMsg) : []

  const augmentedDialog =
    relatedBlogs.length > 0
      ? [{ role: "system", content: buildBlogContext(relatedBlogs) }, ...dialogText]
      : dialogText

  try {
    const upstream = await proxyStreamToPythonAgent("/v1/chat/stream", {
      method: "POST",
      body: JSON.stringify({ dialogText: augmentedDialog }),
      signal: req.signal,
    })
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
      },
    })
  } catch (error) {
    console.error("聊天服务失败:", error)
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
