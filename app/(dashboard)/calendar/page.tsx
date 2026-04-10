"use client"

import { CalendarGrid } from "@/components/calendar/CalendarGrid"
import { useTenant } from "@/lib/hooks/use-tenant"

export default function CalendarPage() {
  const { tenantId } = useTenant()

  return (
    <div className="space-y-6">
      <CalendarGrid tenantId={tenantId} />
    </div>
  )
}
