"use client"

import { Suspense } from "react"
import { GuestsPageClient } from "./guests-page-client"

export default function GuestsPage() {
  return (
    <Suspense fallback={<GuestsPageFallback />}>
      <GuestsPageClient />
    </Suspense>
  )
}

function GuestsPageFallback() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold font-headline">אורחים</h1>
      <div className="h-[48px] bg-accent rounded-xl animate-pulse" />
      <div className="bg-card rounded-[20px] border border-border/20 shadow-sm">
        <div className="animate-pulse">
          <div className="h-12 bg-accent/50 rounded-t-[20px]" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-border/10" />
          ))}
        </div>
      </div>
    </div>
  )
}
