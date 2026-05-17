"use client"

import { useEffect, useState } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass, textareaClass } from "@/components/shared/FormField"
import { DateInput } from "@/components/shared/DateInput"
import { TimeInput } from "@/components/shared/TimeInput"
import {
  upsertAttendanceEntry,
} from "@/lib/actions/attendance"
import type {
  AttendanceRecord,
  AttendanceEntryType,
  AttendanceStaffOption,
} from "@/lib/types/attendance"

/* ── Entry-type catalog ──────────────────────────────────────── */

const ENTRY_TYPES: { value: AttendanceEntryType; label: string; emoji: string }[] = [
  { value: "regular",  label: "רגיל",     emoji: "🟦" },
  { value: "vacation", label: "חופשה",    emoji: "🏖️" },
  { value: "sick",     label: "מחלה",     emoji: "🏥" },
  { value: "holiday",  label: "חג",       emoji: "📅" },
  { value: "absence",  label: "היעדרות",  emoji: "❌" },
]

/* ── Time helper — extract HH:MM in Asia/Jerusalem from ISO ──── */

function isoToLocalTime(iso: string | null | undefined): string {
  if (!iso) return ""
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return new Intl.DateTimeFormat("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    }).format(d)
  } catch {
    return ""
  }
}

/* ── Props ───────────────────────────────────────────────────── */

interface AttendanceEntryPanelProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  /** Existing record to edit. Omit for create-mode. */
  record?: AttendanceRecord | null
  /** Pre-fill the date when creating a new row. */
  defaultDate?: string
  /** Pre-fill the employee when in single-employee view. */
  defaultUserId?: string
  /**
   * When defined → employee selector is hidden and the panel uses this
   * employee. Pass undefined to render the picker (manager all-employees
   * view).
   */
  lockedUserId?: string
  /** Roster for the employee picker (all-employees view). */
  staffOptions: AttendanceStaffOption[]
}

/* ── Component ───────────────────────────────────────────────── */

export function AttendanceEntryPanel({
  isOpen,
  onClose,
  onSaved,
  record,
  defaultDate,
  defaultUserId,
  lockedUserId,
  staffOptions,
}: AttendanceEntryPanelProps) {
  const isEdit = !!record?.id
  const showPicker = !lockedUserId

  const [userId, setUserId] = useState<string>("")
  const [workDate, setWorkDate] = useState<string>("")
  const [entryType, setEntryType] = useState<AttendanceEntryType>("regular")
  const [clockInTime, setClockInTime] = useState<string>("")
  const [clockOutTime, setClockOutTime] = useState<string>("")
  const [notes, setNotes] = useState<string>("")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")

  /* Reset form on open / when the record changes */
  useEffect(() => {
    if (!isOpen) return

    if (record) {
      setUserId(record.user_id)
      setWorkDate(record.work_date)
      setEntryType(record.entry_type)
      setClockInTime(record.entry_type === "regular" ? isoToLocalTime(record.clock_in) : "")
      setClockOutTime(record.entry_type === "regular" ? isoToLocalTime(record.clock_out) : "")
      setNotes(record.notes ?? "")
    } else {
      setUserId(lockedUserId ?? defaultUserId ?? "")
      setWorkDate(defaultDate ?? new Date().toISOString().slice(0, 10))
      setEntryType("regular")
      setClockInTime("")
      setClockOutTime("")
      setNotes("")
    }
    setError("")
  }, [isOpen, record, defaultDate, defaultUserId, lockedUserId])

  async function handleSave() {
    setError("")

    const resolvedUserId = lockedUserId ?? userId
    if (!resolvedUserId) {
      setError("יש לבחור עובד")
      return
    }
    if (!workDate) {
      setError("יש לבחור תאריך")
      return
    }
    if (entryType === "regular" && !clockInTime) {
      setError("שעת הגעה נדרשת למשמרת רגילה")
      return
    }

    setSaving(true)
    const res = await upsertAttendanceEntry({
      id: record?.id ?? null,
      user_id: resolvedUserId,
      work_date: workDate,
      entry_type: entryType,
      clock_in_time: entryType === "regular" ? clockInTime : null,
      clock_out_time: entryType === "regular" ? clockOutTime || null : null,
      notes: notes.trim() || null,
    })
    setSaving(false)

    if (!res.success) {
      setError(res.error || "שגיאה בשמירה")
      return
    }
    onSaved()
    onClose()
  }

  const isRegular = entryType === "regular"

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "עריכת רישום נוכחות" : "רישום נוכחות חדש"}
      subtitle={isEdit ? "שינוי שעות הגעה / יציאה / סוג" : "הוספת ידנית של רישום נוכחות"}
      noPadding
    >
      <div className="flex flex-col h-full min-h-0 bg-white">
        {/* ── Error banner ── */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3 shrink-0">
            <Icon name="error" size="sm" className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-red-800">{error}</p>
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Section: who & when */}
          <div className="bg-accent/50 rounded-[20px] p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">פרטי הרישום</h3>

            {showPicker && (
              <FormField label="עובד" required>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— בחר עובד —</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="תאריך" required>
              <DateInput value={workDate} onChange={setWorkDate} />
            </FormField>

            <FormField label="סוג רישום" required>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as AttendanceEntryType)}
                className={selectClass}
              >
                {ENTRY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.emoji} {t.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Section: hours (regular only) */}
          {isRegular && (
            <div className="bg-accent/50 rounded-[20px] p-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground">שעות עבודה</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="שעת הגעה" required>
                  <TimeInput value={clockInTime} onChange={setClockInTime} />
                </FormField>

                <FormField label="שעת יציאה">
                  <TimeInput value={clockOutTime} onChange={setClockOutTime} />
                </FormField>
              </div>

              <p className="text-[11px] text-muted-foreground mr-1">
                שעת יציאה ריקה = משמרת פתוחה. ניתן לעדכן בהמשך.
              </p>
            </div>
          )}

          {/* Section: notes */}
          <div className="bg-accent/50 rounded-[20px] p-5">
            <FormField label="הערה">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={textareaClass}
                rows={3}
                placeholder="הערה פנימית (אופציונלי)"
              />
            </FormField>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-start gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#1e40af] text-white font-bold text-sm hover:bg-[#1e3a8a] transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Icon name="hourglass_empty" size="sm" className="text-white animate-spin" />
            ) : (
              <Icon name="check_circle" size="sm" className="text-white" />
            )}
            {saving ? "שומר..." : isEdit ? "שמור שינויים" : "הוסף רישום"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border/40 text-muted-foreground font-bold text-sm hover:bg-accent transition-colors min-h-[44px] disabled:opacity-50"
          >
            ביטול
          </button>
        </div>
      </div>
    </SidePanel>
  )
}

/* ── Helper export — reused by the page for visual tagging ──── */

export const ENTRY_TYPE_META: Record<
  AttendanceEntryType,
  { label: string; emoji: string }
> = ENTRY_TYPES.reduce(
  (acc, t) => {
    acc[t.value] = { label: t.label, emoji: t.emoji }
    return acc
  },
  {} as Record<AttendanceEntryType, { label: string; emoji: string }>,
)
