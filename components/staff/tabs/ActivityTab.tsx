"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { getEmployeeActivity } from "@/lib/actions/staff"
import { useTenant } from "@/lib/hooks/use-tenant"
import type { EmployeeActivity } from "@/lib/types/staff"

/* ── Props ─────────────────────────────────────────────────── */

interface ActivityTabProps {
  employeeId: string
}

/* ── Activity Icon Map ─────────────────────────────────────── */

const ACTIVITY_ICON: Record<string, string> = {
  task_completed: "check_circle",
  task_assigned: "assignment",
  login: "login",
  status_change: "swap_horiz",
}

/* ── Component ─────────────────────────────────────────────── */

export function ActivityTab({ employeeId }: ActivityTabProps) {
  const { tenantId } = useTenant()
  const [activities, setActivities] = useState<EmployeeActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getEmployeeActivity(employeeId, tenantId).then((data) => {
      setActivities(data)
      setLoading(false)
    })
  }, [employeeId, tenantId])

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
        <p className="text-sm font-medium">טוען פעילות...</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Icon name="history" size="xl" className="opacity-30" />
        <p className="text-lg font-medium">אין פעילות</p>
        <p className="text-sm">לא נמצאה פעילות אחרונה לעובד זה</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">פעילות אחרונה</h3>

      <div className="bg-card rounded-[20px] border border-border/15 shadow-sm divide-y divide-border/10">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon
                name={ACTIVITY_ICON[activity.type] || "event"}
                size="sm"
                className="text-muted-foreground"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">{activity.description}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatTime(activity.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
