"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { DateInput } from "@/components/shared/DateInput"
import {
  createAreaCleaningTask,
  createManualCleaningTask,
  getCleanersList,
} from "@/lib/actions/cleaning"
import { uploadCleaningTaskImage } from "@/lib/actions/upload"
import { getAreasForPicker } from "@/lib/actions/areas"
import { getRoomsForPicker } from "@/lib/actions/maintenance"
import type { AreaPickerItem } from "@/lib/types/area"
import type { CleanerSummary } from "@/lib/types/cleaning"

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
  max_occupancy: number | null
}

const inputClass =
  "w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm text-right focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[48px]"
const selectClass = `${inputClass} pe-10 appearance-none cursor-pointer select-arrow`
const labelClass = "block text-xs font-bold text-muted-foreground mb-1.5"
const cardClass = "bg-card rounded-[20px] border border-border/15 p-5 shadow-sm"

const GUEST_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const
const GUEST_COUNT_MIN = GUEST_COUNT_OPTIONS[0]
const GUEST_COUNT_MAX = GUEST_COUNT_OPTIONS[GUEST_COUNT_OPTIONS.length - 1]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

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
  const [cleaners, setCleaners] = useState<CleanerSummary[]>([])
  const [targetId, setTargetId] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [guestCount, setGuestCount] = useState<number | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [executionDate, setExecutionDate] = useState<string>(scheduledDate || todayIso())
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    getAreasForPicker(tenantId, { cleaningRelevant: true }).then(setAreas)
    getRoomsForPicker(tenantId).then(setRooms)
    getCleanersList(tenantId).then(setCleaners)
    setExecutionDate(scheduledDate || todayIso())
  }, [isOpen, tenantId, scheduledDate])

  // Reset target selection + guest count when target type flips
  useEffect(() => {
    setTargetId("")
    if (targetType === "area") setGuestCount(null)
  }, [targetType])

  // When a room is picked, default guest_count to a sane value within the
  // toggle range, clamped by the room's max_occupancy.
  useEffect(() => {
    if (targetType !== "room" || !targetId) return
    const r = rooms.find((x) => x.id === targetId)
    const cap = r?.max_occupancy ?? GUEST_COUNT_MIN
    const clamped = Math.min(Math.max(cap, GUEST_COUNT_MIN), GUEST_COUNT_MAX)
    setGuestCount(clamped)
  }, [targetId, targetType, rooms])

  // Build object-URL preview when a file is picked, and clean it up on change
  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function reset() {
    setTargetType("room")
    setTargetId("")
    setAssignedTo("")
    setGuestCount(null)
    setImageFile(null)
    setImagePreview(null)
    setExecutionDate(todayIso())
    setNotes("")
    setError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit() {
    setError("")

    if (!targetId) {
      setError(targetType === "room" ? "יש לבחור חדר" : "יש לבחור אזור")
      return
    }
    if (!assignedTo) {
      setError("חובה לבחור עובד אחראי למשימה זו")
      return
    }
    if (targetType === "room" && !guestCount) {
      setError("חובה לבחור עבור כמה אורחים להכין את החדר")
      return
    }

    setSaving(true)

    try {
      let imageUrl: string | null = null
      if (imageFile) {
        const fd = new FormData()
        fd.append("file", imageFile)
        const up = await uploadCleaningTaskImage(fd)
        if (!up.success || !up.url) {
          setSaving(false)
          setError(up.error || "שגיאה בהעלאת התמונה")
          return
        }
        imageUrl = up.url
      }

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
          scheduled_date: executionDate,
          assigned_to: assignedTo,
          notes: notes.trim() || undefined,
        })
      } else {
        res = await createManualCleaningTask(tenantId, {
          room_id: targetId,
          reservation_id: null,
          reservation_room_id: null,
          checkin_date: null,
          checkout_date: executionDate,
          scheduled_date: executionDate,
          cleaner_user_id: assignedTo,
          notes: notes.trim() || undefined,
          guest_count: guestCount,
          image_url: imageUrl,
        })
      }

      if (!res.success) {
        setSaving(false)
        setError(res.error || "שגיאה ביצירת המשימה")
        return
      }

      reset()
      onCreated()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (file && !file.type.startsWith("image/")) {
      setError("יש לבחור קובץ תמונה בלבד")
      return
    }
    setError("")
    setImageFile(file)
  }

  function clearImage() {
    setImageFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const submitDisabled =
    saving ||
    !targetId ||
    !assignedTo ||
    (targetType === "room" && !guestCount)

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="משימת ניקיון חדשה"
      subtitle="בחירת יעד, שיבוץ עובד ויצירת משימה"
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
            disabled={submitDisabled}
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

        {/* ── 1. Target ───────────────────────────────────── */}
        <div className={`${cardClass} space-y-4`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">פרטי המשימה</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
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
        </div>

        {/* ── 2. Image (optional) ─────────────────────────── */}
        <div className={`${cardClass} space-y-3`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">
              תמונה{" "}
              <span className="text-xs font-medium text-muted-foreground">(אופציונלי)</span>
            </h3>
          </div>

          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-border/30">
              <Image
                src={imagePreview}
                alt="תצוגה מקדימה"
                width={480}
                height={320}
                unoptimized
                className="w-full h-48 object-cover"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-2 left-2 min-h-[44px] min-w-[44px] rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
                aria-label="הסר תמונה"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 min-h-[120px] rounded-xl border-2 border-dashed border-border/40 hover:border-primary/40 hover:bg-accent/30 transition-colors cursor-pointer p-4 text-center">
              <Icon name="add_a_photo" size="md" className="text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">העלאת תמונה</span>
              <span className="text-[11px] text-muted-foreground">JPG / PNG / WEBP — עד 8MB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFilePick}
                className="sr-only"
              />
            </label>
          )}
        </div>

        {/* ── 3. Date + Assignee (shared row) ─────────────── */}
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1 items-stretch">
          <div className={`${cardClass} flex flex-col space-y-3`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h3 className="text-base font-bold text-foreground">תאריך ביצוע</h3>
            </div>
            <div className="mt-auto">
              <DateInput value={executionDate} onChange={setExecutionDate} />
            </div>
          </div>

          <div className={`${cardClass} flex flex-col space-y-3`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h3 className="text-base font-bold text-foreground">
                הקצאת עובד אחראי <span className="text-red-600">*</span>
              </h3>
            </div>
            <div className="mt-auto">
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={selectClass}
              >
                <option value="">בחר עובד אחראי...</option>
                {cleaners.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
              {cleaners.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  אין עובדי ניקיון פעילים. הוסף משתמש עם תפקיד &quot;עובד ניקיון&quot; במסך עובדים.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── 4. Guest count (rooms only, required) ───────── */}
        {targetType === "room" && (
          <div className={`${cardClass} space-y-3`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h3 className="text-base font-bold text-foreground">
                מספר אורחים להכנת החדר <span className="text-red-600">*</span>
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              בחר עבור כמה אורחים להכין את החדר
            </p>
            <div className="flex items-stretch gap-2.5" dir="rtl">
              {GUEST_COUNT_OPTIONS.map((n) => {
                const active = guestCount === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setGuestCount(n)}
                    className={`flex-1 min-h-[48px] rounded-full text-base tabular-nums border transition-all ${
                      active
                        ? "bg-primary text-white border-primary font-bold shadow-sm"
                        : "bg-card text-foreground border-border/40 font-medium hover:border-primary/40"
                    }`}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 5. Notes ────────────────────────────────────── */}
        <div className={`${cardClass} space-y-3`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">
              הערות{" "}
              <span className="text-xs font-medium text-muted-foreground">(אופציונלי)</span>
            </h3>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="הערות לעובד..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>
    </SidePanel>
  )
}
