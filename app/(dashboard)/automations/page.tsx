import { Suspense } from "react"
import { AutomationsPageClient } from "./automations-page-client"
import { Icon } from "@/components/shared/Icon"

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
      <Icon name="hourglass_empty" size="xl" className="animate-spin opacity-30" />
      <p className="text-sm">טוען אוטומציות...</p>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AutomationsPageClient />
    </Suspense>
  )
}
