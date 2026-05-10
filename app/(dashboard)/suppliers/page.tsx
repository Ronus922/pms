import { Suspense } from "react"
import { Icon } from "@/components/shared/Icon"
import { SuppliersPageClient } from "./suppliers-page-client"

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
          <p className="text-sm font-medium">טוען ספקים...</p>
        </div>
      }
    >
      <SuppliersPageClient />
    </Suspense>
  )
}
