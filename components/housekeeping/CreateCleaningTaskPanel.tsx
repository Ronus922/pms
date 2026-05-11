"use client"

import { useEffect, useState } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { createAreaCleaningTask, createManualCleaningTask } from "@/lib/actions/cleaning"
import { getAreasForPicker } from "@/lib/actions/areas"
import { getRoomsForPicker } from "@/lib/actions/maintenance"
import type { AreaPickerItem } from "@/lib/types/area"

interface CreateCleaningTaskPanelProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  scheduledDate: string
  onCreated: () => void
}

type TargetType = "room" | "area"

interface RoomPickerItem {
  id: string
  room_number: string
  room_type_name: string
}

const inputClass =
  "w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm text-right focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[48px]"
const selectClass = `${inputClass} pe-10 appearance-none cursor-pointer select-arrow`
const labelClass = "block text-xs font-bold text-muted-foreground mb-1.5"

export function CreateCleaningTaskPanel({
  isOpen,
  onClose,
  tenantId,
  scheduledDate,
  onCreated,
}: CreateCleaningTaskPanelProps) {
  const [targetType, setTargetType] = useState<TargetType>("room")
  const [areas, setAreas] = useState<AreaPickerItem[]>([])
  const [rooms, setRooms] = useState<RoomPickerItem[]>([])
  const [targetId, setTargetId] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isOpen) return
    getAreasForPicker(tenantId, { cleaningRelevant: true }).then(setAreas)
    getRoomsForPicker(tenantId).then(setRooms)
  }, [isOpen, tenantId])

  // Reset selection when target type changes
  useEffect(() => {
    setTargetId("")
  }, [targetType])

  function reset() {
    setTargetType("room")
    setTargetId("")
    setNotes("")
    setError("")
  }

  async function handleSubmit() {
    if (!targetId) {
      setError(targetType === "room" ? "יש לבחור חדר" : "יש לבחור אזור")
      return
    }

    setSaving(true)
    setError("")

    let res: { success: boolean; error?: string }
    if (targetType === "area") {
      const area = areas.find((a) => a.id === targetId)
      if (!area) {
        setSaving(false)
        setError("אזור לא תקין")
        return
      }
      res = await createAreaCleaningTask(tenantId, {
        area_id: area.id,
        area_name: area.name,
        scheduled_date: scheduledDate,
        notes: notes.trim() || undefined,
      })
    } else {
      res = await createManualCleaningTask(tenantId, {
        room_id: targetId,
        reservation_id: null,
        reservation_room_id: null,
        checkin_date: null,
        checkout_date: scheduledDate,
        cleaner_user_id: null,
        notes: notes.trim() || undefined,
      })
    }

    setSaving(false)
    if (!res.success) {
      setError(res.error || "שגיאה ביצירת המשימה")
      return
    }
    reset()
    onCreated()
    onClose()
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="משימת ניקיון חדשה"
      subtitle="בחירת יעד ויצירת משימה לעובד ניקיון"
      footer={
        <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-row-reverse">
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-outline"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !targetId}
            className="btn btn-primary"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="add" size="sm" />
            )}
            צור משימה
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <Icon name="error" size="sm" className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">פרטי המשימה</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>סוג יעד</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as TargetType)}
                className={selectClass}
              >
                <option value="room">חדר</option>
                <option value="area">אזור</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>יעד *</label>
              {targetType === "room" ? (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">בחר חדר</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      חדר {r.room_number}
                      {r.room_type_name ? ` — ${r.room_type_name}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">בחר אזור</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.area_type_label}
                    </option>
                  ))}
                </select>
              )}
              {targetType === "area" && areas.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  אין אזורים מוגדרים. הוסף אזור במסך &quot;חדרים ואזורים&quot;.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>הערות (אופציונלי)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="הערות לעובד..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className={labelClass}>תאריך</label>
            <div className="bg-accent rounded-xl px-5 py-3.5 text-sm text-right text-muted-foreground min-h-[48px] flex items-center">
              {scheduledDate}
            </div>
          </div>
        </div>
      </div>
    </SidePanel>
  )
}
