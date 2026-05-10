"use client"

import { Suspense } from "react"
import { StaffPageClient } from "./staff-page-client"
import { Icon } from "@/components/shared/Icon"

function StaffFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
      <p className="text-sm font-medium">טוען עובדים...</p>
    </div>
  )
}

export default function StaffPage() {
  return (
    <Suspense fallback={<StaffFallback />}>
      <StaffPageClient />
    </Suspense>
  )
}
