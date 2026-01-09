import Link from "next/link"
import { Github } from "lucide-react"

export default function Footer() {
  return (
    <footer className="border-t py-6 md:py-8">
      <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 px-4 md:px-6">
        <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center">
          <Link href="/" className="font-semibold">
            旅行规划
          </Link>
          <nav className="flex gap-4 md:gap-6 flex-wrap justify-center">
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">
              关于我们
            </Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
              联系我们
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              隐私政策
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              使用条款
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="https://github.com" target="_blank" rel="noopener noreferrer">
            <Github className="h-5 w-5" />
            <span className="sr-only">GitHub</span>
          </Link>
          <p className="text-sm text-muted-foreground">© 2025 旅行规划. 保留所有权利.</p>
        </div>
      </div>
    </footer>
  )
}
