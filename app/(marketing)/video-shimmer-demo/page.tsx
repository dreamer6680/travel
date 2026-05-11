'use client'

import { useState } from 'react'

const DEMO_TITLES = [
  'Scene 1 - Opening',
  'Scene 2 - Problem',
  'Scene 3 - Solution',
  'Scene 4 - CTA',
]

/** 本地占位：原 `@/features/video/.../VideoGeneratingArtifact` 未纳入本仓库 */
function LoadingScene({ title }: { title?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {title ? (
        <div className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">{title}</div>
      ) : null}
      <div className="space-y-3 p-4">
        <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

export default function VideoGeneratingArtifactLoadingPage() {
  const [showTitle, setShowTitle] = useState(true)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-primary">Video Generating Shimmer Test</h1>
        <p className="text-sm text-muted-foreground">
          占位骨架屏（原业务组件未在本仓库）；用于预览卡片加载态布局。
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowTitle((v) => !v)}
          className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
        >
          {showTitle ? 'Hide titles' : 'Show titles'}
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DEMO_TITLES.map((title) => (
          <LoadingScene key={title} title={showTitle ? title : undefined} />
        ))}
      </section>

      <section className="max-w-sm space-y-2">
        <p className="text-sm font-medium text-primary">Single Card</p>
        <LoadingScene title={showTitle ? 'Generating...' : undefined} />
      </section>
    </main>
  )
}
