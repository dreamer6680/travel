"use client"

import dynamic from "next/dynamic"

// LocatorRuntime 依赖 solid-js/web，SSR 时触发 React 引用冲突，必须纯客户端加载
const LocatorRuntime = dynamic(() => import("./locator-runtime"), { ssr: false })

export default function LocatorRuntimeLoader() {
  return <LocatorRuntime />
}
