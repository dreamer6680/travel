'use client'

import { useState } from 'react'
import { LoadingScene } from '@/features/video/detail/components/VideoGeneratingArtifact'

const DEMO_TITLES = [
  'Scene 1 - Opening',
  'Scene 2 - Problem',
  'Scene 3 - Solution',
  'Scene 4 - CTA',
]

export default function VideoGeneratingArtifactLoadingPage() {
  const [showTitle, setShowTitle] = useState(true)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-primary">Video Generating Shimmer Test</h1>
        <p className="text-sm text-muted-foreground">
          Isolated preview for the `LoadingScene` shimmer used in video generation artifacts.
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
