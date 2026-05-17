"use client"

/**
 * AttendanceTab — per-employee attendance policy configuration.
 * ─────────────────────────────────────────────────────────────
 * Lives inside `EmployeeSidePanel`. Inputs are ALWAYS editable (no edit-
 * mode gate) — admins shouldn't need to click "ערוך פרופיל" before flipping
 * an attendance setting. The panel's footer save button still triggers the
 * `staff-panel-save` event, which this tab handles (project convention —
 * see ProfileTab). The footer button is enabled for this tab regardless
 * of panelMode (handled in EmployeeSidePanel).
 */

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Icon } from "@/components/shared/Icon"
import { AreaSelector } from "@/components/attendance/AreaSelector"
import { useTenant } from "@/lib/hooks/use-tenant"
import {
  getAttendanceSettings,
  updateAttendanceSettings,
} from "@/lib/actions/attendance-settings"
import { listAttendanceAreasForPicker } from "@/lib/actions/attendance-areas"
import {
  ATTENDANCE_REQUIRED,
  ATTENDANCE_REQUIRED_LABELS,
  attendanceRequiresArea,
  type AttendanceRequired,
} from "@/lib/constants/attendance"
import type { AttendanceAreaPickerItem } from "@/lib/types/attendance"
import type { EmployeeWithPermissions } from "@/lib/types/staff"

interface AttendanceTabProps {
  employee: EmployeeWithPermissions
  onSaved: () => void
}

interface FormState {
  attendance_required: AttendanceRequired
  attendance_area_id: string | null
}

const INITIAL_FORM: FormState = {
  attendance_required: "none",
  attendance_area_id: null,
}

export function AttendanceTab({
  employee,
  onSaved,
}: AttendanceTabProps) {
  const { tenantId } = useTenant()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [areas, setAreas] = useState<AttendanceAreaPickerItem[]>([])
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  // ── Initial load ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [settings, areaList] = await Promise.all([
          getAttendanceSettings(employee.id),
          listAttendanceAreasForPicker(),
        ])
        if (cancelled) return

        if (settings) {
          setForm({
            attendance_required: settings.attendance_required,
            attendance_area_id: settings.attendance_area_id,
          })
        }
        setAreas(areaList)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [employee.id])

  // ── Cross-panel refresh: when AttendanceAreasSidePanel mutates the
  //    area list (create/edit/delete), it dispatches this event. We
  //    refetch the picker so a freshly-created area appears immediately.
  useEffect(() => {
    const handler = () => {
      listAttendanceAreasForPicker()
        .then((rows) => setAreas(rows))
        .catch(() => {
          // Stale list is recoverable — no need to surface an error.
        })
    }
    document.addEventListener("attendance-areas-changed", handler)
    return () => document.removeEventListener("attendance-areas-changed", handler)
  }, [])

  // ── Save (called by panel save event) ──────────────────────
  async function handleSave() {
    if (
      attendanceRequiresArea(form.attendance_required) &&
      !form.attendance_area_id
    ) {
      const msg = "ברמת דיווח 'בתוך/מחוץ לאזור' חובה לבחור אזור"
      setError(msg)
      toast.error(msg)
      return
    }

    setSaving(true)
    setError("")

    const res = await updateAttendanceSettings(tenantId, {
      user_id: employee.id,
      attendance_required: form.attendance_required,
      attendance_area_id: form.attendance_area_id,
    })

    setSaving(false)

    if (!res.success) {
      const msg = res.error || "שגיאה בעדכון הגדרות הדיווח"
      setError(msg)
      toast.error(msg)
      return
    }

    toast.success("הגדרות הדיווח נשמרו")
    onSaved()
  }

  useEffect(() => {
    const handler = () => {
      handleSave()
    }
    document.addEventListener("staff-panel-save", handler)
    return () => document.removeEventListener("staff-panel-save", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  // ── Helpers ────────────────────────────────────────────────
  function setLevel(level: AttendanceRequired) {
    setForm((f) => ({
      ...f,
      attendance_required: level,
      // Clear area_id when switching to a level that doesn't need an area.
      attendance_area_id: attendanceRequiresArea(level)
        ? f.attendance_area_id
        : null,
    }))
    if (error) setError("")
  }

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
        <Icon
          name="hourglass_empty"
          size="md"
          className="opacity-30 animate-spin"
        />
        <p className="text-sm">טוען הגדרות דיווח...</p>
      </div>
    )
  }

  const showAreaSelector = attendanceRequiresArea(form.attendance_required)

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Icon
            name="error"
            size="sm"
            className="text-red-600 flex-shrink-0 mt-0.5"
          />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* ── Level radios ───────────────────────────────────── */}
      <div className="rounded-[20px] bg-card p-5 shadow-sm border border-border/20 space-y-3">
        <h3 className="text-base font-bold text-foreground">רמת דיווח</h3>
        <fieldset className="space-y-1">
          <legend className="sr-only">רמת דיווח נוכחות</legend>
          {ATTENDANCE_REQUIRED.map((level) => {
            const isActive = form.attendance_required === level
            return (
              <label
                key={level}
                className={[
                  "flex items-center gap-3 p-3 rounded-xl transition-colors min-h-[44px] cursor-pointer",
                  isActive ? "bg-[#eff6ff]" : "hover:bg-[#f4f2fc]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="attendance_required"
                  value={level}
                  checked={isActive}
                  onChange={() => setLevel(level)}
                  className="h-4 w-4 cursor-pointer accent-[#1e40af]"
                />
                <span className="text-sm text-foreground">
                  {ATTENDANCE_REQUIRED_LABELS[level]}
                </span>
              </label>
            )
          })}
        </fieldset>
      </div>

      {/* ── Area selector (conditional) ────────────────────── */}
      {showAreaSelector && (
        <div className="rounded-[20px] bg-card p-5 shadow-sm border border-border/20 space-y-3">
          <h3 className="text-base font-bold text-foreground">אזור הדיווח</h3>
          <AreaSelector
            value={form.attendance_area_id}
            onChange={(id) =>
              setForm((f) => ({ ...f, attendance_area_id: id }))
            }
            areas={areas}
          />
          {areas.length === 0 && (
            <p className="text-xs text-amber-700">
              אין אזורים מוגדרים. ליצירת אזור — לחץ על &quot;אזורי דיווח&quot;
              בעמוד עובדים.
            </p>
          )}
        </div>
      )}

      {/* ── Saving indicator ───────────────────────────────── */}
      {saving && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Icon name="hourglass_empty" size="sm" className="animate-spin" />
          שומר...
        </div>
      )}
    </div>
  )
}
