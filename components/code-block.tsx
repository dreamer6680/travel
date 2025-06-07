"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Copy, Eye, Code } from "lucide-react"

interface CodeBlockProps {
  language: string
  code: string
  filename?: string
}

export function CodeBlock({ language, code, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isWebCode =
    language === "html" ||
    language === "xml" ||
    (language === "javascript" && code.includes("document")) ||
    language === "css"

  const createPreviewContent = () => {
    if (language === "html" || language === "xml") {
      return code
    }

    if (language === "css") {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            ${code}
          </style>
        </head>
        <body>
          <div class="demo-content">
            <h1>CSS 样式预览</h1>
            <p>这是一个段落文本</p>
            <button>按钮</button>
            <div class="box">盒子元素</div>
          </div>
        </body>
        </html>
      `
    }

    if (language === "javascript") {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .demo-content { max-width: 600px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="demo-content">
            <h1>JavaScript 代码预览</h1>
            <div id="output"></div>
          </div>
          <script>
            ${code}
          </script>
        </body>
        </html>
      `
    }

    return code
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-muted border-b">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4" />
          <span className="text-sm font-medium">{filename || language.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          {isWebCode && (
            <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-4 w-4 mr-1" />
              {showPreview ? "隐藏预览" : "预览"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={copyToClipboard}>
            <Copy className="h-4 w-4 mr-1" />
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
      </div>

      <div className="relative">
        <pre className="p-4 overflow-x-auto text-sm font-mono bg-black text-white dark:bg-zinc-900">
          <code>{code}</code>
        </pre>
      </div>

      {showPreview && isWebCode && (
        <div className="border-t">
          <div className="p-3 bg-muted">
            <span className="text-sm font-medium">预览效果：</span>
          </div>
          <div className="p-4">
            <iframe
              srcDoc={createPreviewContent()}
              className="w-full h-96 border rounded"
              sandbox="allow-scripts"
              title="代码预览"
            />
          </div>
        </div>
      )}
    </Card>
  )
}
