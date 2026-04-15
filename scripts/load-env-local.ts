/**
 * 从项目根目录加载 .env.local 到 process.env，供在 scripts 目录下直接 npx tsx xxx.ts 时使用。
 * 必须在其它依赖 process.env 的模块之前 import。
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, "..", ".env.local")
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8")
  const lines = content.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim().replace(/\r$/, "")

    // 支持跨行的引号值（例如超长 Cookie 被意外换行）
    if (
      (value.startsWith('"') && !value.endsWith('"')) ||
      (value.startsWith("'") && !value.endsWith("'"))
    ) {
      const quote = value[0]
      while (i + 1 < lines.length && !value.endsWith(quote)) {
        i++
        value += `\n${lines[i].replace(/\r$/, "")}`
      }
    }

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"')
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replace(/\\'/g, "'")
    } else {
      // 兜底：容错单边引号，避免把引号本身带入 header
      value = value.replace(/^["']/, "").replace(/["']$/, "")
    }

    if (key) process.env[key] = value
  }
}
