import fs from "fs"
import path from "path"
import { createRequire } from "module"
import { fileURLToPath } from "url"
import { unshiftLoader } from "next/dist/build/webpack/config/helpers.js"

const require = createRequire(import.meta.url)
const webpack = require("next/dist/compiled/webpack/webpack-lib.js")

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// pnpm 下 solid-js 常在 .pnpm/solid-js@版本/node_modules/solid-js，供 Locator polyfill 使用
function resolveSolidWebBrowserPath() {
  const pnpmDir = path.join(__dirname, "node_modules", ".pnpm")
  if (!fs.existsSync(pnpmDir)) return null
  const dir = fs.readdirSync(pnpmDir).find((d) => d.startsWith("solid-js@"))
  if (!dir) return null
  const webJs = path.join(pnpmDir, dir, "node_modules", "solid-js", "web", "dist", "web.js")
  return fs.existsSync(webJs) ? webJs : null
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 生产构建输出独立目录，使 Docker 镜像体积从 ~1GB 降至 ~200MB
  output: "standalone",
  // LocatorJS（Next.js 15+）：与官方文档一致
  // Turbopack：https://www.locatorjs.com/install/react
  turbopack: {
    rules: {
      // 比官网多带 .ts/.js，覆盖 App Router 常见文件
      "**/*.{tsx,ts,jsx,js}": {
        loaders: [
          {
            loader: "@locator/webpack-loader",
            options: { env: "development" },
          },
        ],
      },
    },
  },
  // Webpack：官方示例为 rules.push；Next 的 oneOf 需用 unshiftLoader 插到最前才稳定生效
  // https://www.locatorjs.com/install/react
  webpack: (config, { isServer, dev }) => {
    // @locator/runtime 依赖 solid-js/web 的 setStyleProperty（solid-js 1.9+ 已移除）→ 用 polyfill 补全
    if (!isServer) {
      const solidWebBrowser = resolveSolidWebBrowserPath()
      const polyfillPath = path.join(__dirname, "lib/solid-web-locator-polyfill.js")
      if (solidWebBrowser) {
        config.resolve.alias = {
          ...config.resolve.alias,
          "solid-js/web-locator-internals": solidWebBrowser,
          "solid-js/web": polyfillPath,
          "solid-js/web$": polyfillPath,
        }
        config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^solid-js\/web$/, polyfillPath))
      }
    }
    // App Router 下大量 UI 走服务端编译：只在 client 注入会导致「No source info」
    // isServer 判断：避免 solid-js/web polyfill 污染 SSR bundle，导致 React 为 null
    if (dev && !isServer) {
      unshiftLoader(
        {
          oneOf: [
            {
              enforce: "pre",
              test: /\.(tsx|ts|jsx|js)$/,
              exclude: /node_modules/,
              use: [
                {
                  loader: "@locator/webpack-loader",
                  options: { env: "development" },
                },
              ],
            },
          ],
        },
        config
      )
    }
    return config
  },
}

export default nextConfig
