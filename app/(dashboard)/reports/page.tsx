import { Suspense } from "react"
import { ReportsCenter } from "@/components/reports/ReportsCenter"
import { Icon } from "@/components/shared/Icon"

function ReportsLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
      <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
      <p className="text-lg font-medium">טוען דוחות...</p>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsLoading />}>
      <ReportsCenter />
    </Suspense>
  )
}
