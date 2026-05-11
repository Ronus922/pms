"use client"

import { CalendarBoard } from "@/components/calendar/CalendarBoard"
import { useTenant } from "@/lib/hooks/use-tenant"

export default function CalendarPage() {
  const { tenantId } = useTenant()

  return <CalendarBoard tenantId={tenantId} />
}
