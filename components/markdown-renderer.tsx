"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CodeBlock } from "./code-block"
import Link from "next/link"
import { BookOpen, ExternalLink } from "lucide-react"

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "")
          const language = match ? match[1] : ""
          const code = String(children).replace(/\n$/, "")

          if (!inline && language) {
            return <CodeBlock language={language} code={code} />
          }

          return (
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
              {children}
            </code>
          )
        },
        a({ href, children }) {
          // Blog citation — special chip style
          if (href?.startsWith("/blogs/")) {
            return (
              <Link
                href={href}
                target="_blank"
                className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-full
                  bg-emerald-50 text-emerald-700 border border-emerald-200
                  text-[13px] font-medium no-underline
                  hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
              >
                <BookOpen className="h-3 w-3 flex-shrink-0" />
                <span>{children}</span>
              </Link>
            )
          }
          // External link
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80
                inline-flex items-center gap-0.5"
            >
              {children}
              <ExternalLink className="h-3 w-3" />
            </a>
          )
        },
        h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>,
        p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border-collapse border border-border">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border px-4 py-2 bg-muted font-semibold text-left">{children}</th>
        ),
        td: ({ children }) => <td className="border border-border px-4 py-2">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
