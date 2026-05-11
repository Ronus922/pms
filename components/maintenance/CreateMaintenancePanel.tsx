"use client"

import { useState, useEffect, useRef } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { DateInput } from "@/components/shared/DateInput"
import { TimeInput } from "@/components/shared/TimeInput"
import { toast } from "sonner"
import {
  MAINTENANCE_CATEGORY_MAP,
  MAINTENANCE_TARGET_MAP,
  MAINTENANCE_SOURCE_MAP,
} from "@/lib/constants/maintenance"
import { createMaintenanceTask, getRoomsForPicker, getMaintenanceWorkers, addMaintenanceMedia } from "@/lib/actions/maintenance"
import { getAreasForPicker } from "@/lib/actions/areas"
import type { AreaPickerItem } from "@/lib/types/area"
import type {
  MaintenanceTaskCreateInput,
  MaintenanceWorkerSummary,
  MaintenanceTargetType,
  MaintenanceIssueCategory,
  MaintenancePriority,
  MaintenanceSourceType,
} from "@/lib/types/maintenance"

interface CreateMaintenancePanelProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  userId: string
  userName: string
  onCreated: () => void
}

const inputClass =
  "w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm text-right focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[48px]"
const selectClass = `${inputClass} pe-10 appearance-none cursor-pointer select-arrow`
const labelClass = "block text-xs font-bold text-muted-foreground mb-1.5"

/* ── Urgency levels (replaces both priority + urgency) ───── */

const URGENCY_OPTIONS: Array<{
  value: MaintenancePriority
  label: string
  bg: string
  text: string
  border: string
}> = [
  { value: "low",    label: "נמוכה",  bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-300 dark:border-emerald-700" },
  { value: "medium", label: "בינונית", bg: "bg-amber-50 dark:bg-amber-950/20",    text: "text-amber-700 dark:text-amber-400",    border: "border-amber-300 dark:border-amber-700" },
  { value: "high",   label: "דחופה",  bg: "bg-red-50 dark:bg-red-950/20",        text: "text-red-700 dark:text-red-400",        border: "border-red-300 dark:border-red-700" },
]

const MAX_FILES = 5

export function CreateMaintenancePanel({
  isOpen,
  onClose,
  tenantId,
  userId,
  userName,
  onCreated,
}: CreateMaintenancePanelProps) {
  const [saving, setSaving] = useState(false)
  const [rooms, setRooms] = useState<Array<{ id: string; room_number: string; room_type_name: string }>>([])
  const [workers, setWorkers] = useState<MaintenanceWorkerSummary[]>([])
  const [areas, setAreas] = useState<AreaPickerItem[]>([])

  // Form state
  const [targetType, setTargetType] = useState<MaintenanceTargetType>("room")
  const [targetId, setTargetId] = useState("")
  const [targetLabel, setTargetLabel] = useState("")
  const [roomNumber, setRoomNumber] = useState("")
  const [category, setCategory] = useState<MaintenanceIssueCategory>("general")
  const [sourceType, setSourceType] = useState<MaintenanceSourceType>("manual")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<MaintenancePriority>("medium")
  const [assignedTo, setAssignedTo] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [timeFrom, setTimeFrom] = useState("")
  const [estimatedMinutes, setEstimatedMinutes] = useState("")
  const [requiresCoordination, setRequiresCoordination] = useState(false)
  const [canEnter, setCanEnter] = useState(true)
  const [accessNotes, setAccessNotes] = useState("")

  // Pending files
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    getRoomsForPicker(tenantId).then(setRooms)
    getMaintenanceWorkers(tenantId).then(setWorkers)
    getAreasForPicker(tenantId, { maintenanceRelevant: true }).then(setAreas)
  }, [isOpen, tenantId])

  // Auto-fill target label
  useEffect(() => {
    if (targetType === "room" && targetId) {
      const room = rooms.find((r) => r.id === targetId)
      if (room) {
        setTargetLabel(`חדר ${room.room_number}`)
        setRoomNumber(room.room_number)
      }
    } else if (targetType === "area" && targetId) {
      const area = areas.find((a) => a.id === targetId)
      if (area) {
        setTargetLabel(area.name)
        setRoomNumber("")
      }
    }
  }, [targetType, targetId, rooms, areas])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = "חובה"
    if (!targetLabel.trim() && targetType !== "room" && targetType !== "area") errs.targetLabel = "חובה"
    if (targetType === "room" && !targetId) errs.targetId = "חובה לבחור חדר"
    if (targetType === "area" && !targetId) errs.targetId = "חובה לבחור אזור"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)

    const data: MaintenanceTaskCreateInput = {
      source_type: sourceType,
      target_type: targetType,
      target_id: (targetType === "room" || targetType === "area") ? targetId : undefined,
      target_label: targetLabel,
      room_number: roomNumber || undefined,
      issue_category: category,
      title: title.trim(),
      description: description.trim(),
      priority,
      urgency_level: priority === "high" ? "urgent" : "normal",
      assigned_to: assignedTo || undefined,
      scheduled_date: scheduledDate || undefined,
      scheduled_time_from: timeFrom || undefined,
      estimated_duration_minutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
      requires_guest_coordination: requiresCoordination,
      can_enter_room: canEnter,
      access_notes: accessNotes || undefined,
    }

    const result = await createMaintenanceTask(tenantId, data, userId, userName)

    if (result.success && result.taskId && pendingFiles.length > 0) {
      const fileData = pendingFiles.map((f) => ({
        url: URL.createObjectURL(f),
        name: f.name,
        mime: f.type,
        size: f.size,
      }))
      await addMaintenanceMedia(tenantId, result.taskId, fileData, "before", userId, userName)
    }

    setSaving(false)

    if (result.success) {
      toast.success(`תקלה #${result.taskNumber} נוצרה בהצלחה`)
      resetForm()
      onCreated()
      onClose()
    } else {
      toast.error(result.error ?? "שגיאה ביצירת תקלה")
    }
  }

  const resetForm = () => {
    setTargetType("room")
    setTargetId("")
    setTargetLabel("")
    setRoomNumber("")
    setCategory("general")
    setSourceType("manual")
    setTitle("")
    setDescription("")
    setPriority("medium")
    setAssignedTo("")
    setScheduledDate("")
    setTimeFrom("")
    setEstimatedMinutes("")
    setRequiresCoordination(false)
    setCanEnter(true)
    setAccessNotes("")
    setErrors({})
    setPendingFiles([])
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="פתיחת תקלה חדשה"
      subtitle="יצירת קריאת תחזוקה ושיוך לעובד"
      footer={
        <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-row-reverse">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="add" size="sm" />
            )}
            צור תקלה
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* ── Section 1: פרטי התקלה ──────────────────────── */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">פרטי התקלה</h3>
          </div>

          <div>
            <label className={labelClass}>כותרת *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="תאר את התקלה בקצרה..."
              className={`${inputClass} ${errors.title ? "ring-2 ring-red-400" : ""}`}
            />
            {errors.title && <p className="text-[11px] text-destructive mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className={labelClass}>קטגוריה</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as MaintenanceIssueCategory)} className={selectClass}>
              {Object.entries(MAINTENANCE_CATEGORY_MAP).map(([key, vis]) => (
                <option key={key} value={key}>{vis.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>תיאור (אופציונלי)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="פרט את המשימה, הערות חשובות..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Urgency toggle buttons */}
          <div>
            <label className={labelClass}>דחיפות *</label>
            <div className="grid grid-cols-3 gap-3">
              {URGENCY_OPTIONS.map((opt) => {
                const selected = priority === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-all min-h-[44px] ${
                      selected
                        ? `${opt.bg} ${opt.text} ${opt.border}`
                        : "bg-accent border-border/20 text-muted-foreground hover:border-border/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Target date + time + duration */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>תאריך יעד (אופציונלי)</label>
              <DateInput value={scheduledDate} onChange={setScheduledDate} />
            </div>
            <div>
              <label className={labelClass}>שעה</label>
              <TimeInput value={timeFrom} onChange={setTimeFrom} />
            </div>
            <div>
              <label className={labelClass}>משך (דקות)</label>
              <input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="30"
                className={inputClass}
                min={0}
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: שיבוץ ויעד ──────────────────────── */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">שיבוץ ויעד</h3>
          </div>

          <div>
            <label className={labelClass}>שיוך לעובד</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={selectClass}>
              <option value="">לא משויך</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>סוג יעד</label>
              <select value={targetType} onChange={(e) => { setTargetType(e.target.value as MaintenanceTargetType); setTargetId(""); setTargetLabel(""); setRoomNumber(""); }} className={selectClass}>
                {Object.entries(MAINTENANCE_TARGET_MAP).map(([key, vis]) => (
                  <option key={key} value={key}>{vis.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>יעד</label>
              {targetType === "room" ? (
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={`${selectClass} ${errors.targetId ? "ring-2 ring-red-400" : ""}`}>
                  <option value="">בחר חדר</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>חדר {r.room_number} — {r.room_type_name}</option>
                  ))}
                </select>
              ) : targetType === "area" ? (
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={`${selectClass} ${errors.targetId ? "ring-2 ring-red-400" : ""}`}>
                  <option value="">בחר אזור</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.code ? ` (${a.code})` : ""} — {a.area_type_label}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={targetLabel}
                  onChange={(e) => setTargetLabel(e.target.value)}
                  placeholder="תיאור היעד"
                  className={`${inputClass} ${errors.targetLabel ? "ring-2 ring-red-400" : ""}`}
                />
              )}
              {(errors.targetId || errors.targetLabel) && (
                <p className="text-[11px] text-red-500 mt-1">{errors.targetId || errors.targetLabel}</p>
              )}
            </div>
          </div>

          {/* Room context — only for room target */}
          {targetType === "room" && (
            <div className="space-y-3 pt-2 border-t border-border/10">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-accent">
                <input type="checkbox" checked={requiresCoordination} onChange={(e) => setRequiresCoordination(e.target.checked)} id="coordination" className="w-5 h-5 rounded" />
                <label htmlFor="coordination" className="text-sm font-medium cursor-pointer">דורש תיאום עם אורח</label>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-accent">
                <input type="checkbox" checked={canEnter} onChange={(e) => setCanEnter(e.target.checked)} id="canEnter" className="w-5 h-5 rounded" />
                <label htmlFor="canEnter" className="text-sm font-medium cursor-pointer">ניתן להיכנס לחדר</label>
              </div>
              {!canEnter && (
                <div>
                  <label className={labelClass}>הערות גישה</label>
                  <input value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} placeholder="מפתח אצל הקבלה, אורח ביקש שעה מסוימת..." className={inputClass} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Section 3: תמונות ──────────────────────────── */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="text-base font-bold text-foreground">תמונות</h3>
            <span className="text-[11px] text-muted-foreground ms-auto">(עד {MAX_FILES})</span>
          </div>

          {/* Thumbnails grid */}
          {pendingFiles.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {pendingFiles.map((file, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-border/30 aspect-square bg-accent">
                  {file.type.startsWith("image/") ? (
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                      <Icon name="description" size="lg" className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground text-center truncate w-full">{file.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 left-1 w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload area */}
          {pendingFiles.length < MAX_FILES && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-xl p-8 flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10 hover:border-emerald-400 transition-all min-h-[44px]"
              >
                <Icon name="cloud_upload" size="lg" />
                <span className="text-sm font-bold">בחר מגלריה</span>
                <span className="text-[11px] text-emerald-500">{pendingFiles.length}/{MAX_FILES} תמונות</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                capture="environment"
                onChange={(e) => {
                  if (e.target.files) {
                    const valid = Array.from(e.target.files)
                      .filter((f) => f.size <= 10 * 1024 * 1024)
                      .slice(0, MAX_FILES - pendingFiles.length)
                    setPendingFiles((prev) => [...prev, ...valid])
                  }
                  e.target.value = ""
                }}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>
    </SidePanel>
  )
}
