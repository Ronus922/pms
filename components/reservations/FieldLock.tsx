"use client"

import { Icon } from "@/components/shared/Icon"

/* ── Locked Field Wrapper ──────────────────────────────────── */

interface LockedFieldProps {
  children: React.ReactNode
  message?: string
}

export function LockedField({
  children,
  message = "שדה זה הגיע ממנהל ערוצים חיצוני ולא ניתן לעריכה מתוך המערכת",
}: LockedFieldProps) {
  return (
    <div className="relative">
      <div className="opacity-60 pointer-events-none">{children}</div>
      <div className="absolute top-1/2 -translate-y-1/2 end-3 z-10">
        <Icon name="lock" size="sm" className="text-muted-foreground" />
      </div>
      <p className="text-[12px] text-muted-foreground mt-1 flex items-center gap-1">
        <Icon name="lock" className="!text-[10px]" />
        {message}
      </p>
    </div>
  )
}

/* ── Warning Field Wrapper ─────────────────────────────────── */

interface WarningFieldProps {
  children: React.ReactNode
  message?: string
}

export function WarningField({
  children,
  message = "שינוי שדה זה עלול לא להתעדכן חזרה בערוץ החיצוני",
}: WarningFieldProps) {
  return (
    <div>
      {children}
      <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
        <Icon name="warning" className="!text-[10px]" />
        {message}
      </p>
    </div>
  )
}

/* ── Smart Field — auto-selects wrapper based on permissions ── */

interface SmartFieldProps {
  isExternal: boolean
  lockType: "locked" | "warning" | "editable"
  children: React.ReactNode
}

export function SmartField({ isExternal, lockType, children }: SmartFieldProps) {
  if (!isExternal || lockType === "editable") return <>{children}</>
  if (lockType === "locked") return <LockedField>{children}</LockedField>
  return <WarningField>{children}</WarningField>
}
