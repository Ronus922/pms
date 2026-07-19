"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { FormField, selectClass, textareaClass } from "@/components/shared/FormField"
import { DateInput } from "@/components/shared/DateInput"
import { createClientSupabase } from "@/lib/supabase/client"
import { createAbsenceRequest } from "@/lib/actions/absence-requests"
import type {
  AbsenceRequestType,
  AttachmentInput,
} from "@/lib/types/absence-requests"

const BUCKET = "absence-attachments"
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB

/* ── Request-type catalog ───────────────────────────────────── */

export const REQUEST_TYPE_META: Record<
  AbsenceRequestType,
  { label: string; emoji: string }
> = {
  vacation:     { label: "חופשה",   emoji: "🏖️" },
  sick:         { label: "מחלה",    emoji: "🏥" },
  reserve_duty: { label: "מילואים", emoji: "🪖" },
  personal:     { label: "אישית",   emoji: "📝" },
  unpaid:       { label: "ללא תשלום", emoji: "💸" },
  other:        { label: "אחר",     emoji: "❓" },
}

const TYPE_ORDER: AbsenceRequestType[] = [
  "vacation", "sick", "reserve_duty", "personal", "unpaid", "other",
]

/* ── Helpers ────────────────────────────────────────────────── */

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysBetweenInclusive(start: string, end: string): number {
  if (!start || !end || end < start) return 0
  const a = new Date(`${start}T00:00:00Z`).getTime()
  const b = new Date(`${end}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000) + 1
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function sanitize(name: string): string {
  // ASCII-safe storage key — keep the original name in the DB row.
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file"
}

interface StagedFile {
  file: File
  /** Local preview key — also the React key. */
  id: string
}

/* ── Props ──────────────────────────────────────────────────── */

interface CreateAbsenceRequestPanelProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

/* ── Component ──────────────────────────────────────────────── */

export function CreateAbsenceRequestPanel({
  isOpen,
  onClose,
  onSaved,
}: CreateAbsenceRequestPanelProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [requestType, setRequestType] = useState<AbsenceRequestType>("vacation")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [staged, setStaged] = useState<StagedFile[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")

  /* Reset on open */
  useEffect(() => {
    if (!isOpen) return
    const today = todayIso()
    setRequestType("vacation")
    setStartDate(today)
    setEndDate(today)
    setReason("")
    setStaged([])
    setSaving(false)
    setError("")
  }, [isOpen])

  /* Auto-bump end_date when start moves past it */
  useEffect(() => {
    if (startDate && endDate && endDate < startDate) {
      setEndDate(startDate)
    }
  }, [startDate, endDate])

  const totalDays = useMemo(
    () => daysBetweenInclusive(startDate, endDate),
    [startDate, endDate],
  )

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const next: StagedFile[] = []
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`הקובץ "${f.name}" חורג מ-5MB`)
        continue
      }
      next.push({ file: f, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` })
    }
    if (next.length > 0) setStaged((s) => [...s, ...next])
  }

  function removeStaged(id: string) {
    setStaged((s) => s.filter((x) => x.id !== id))
  }

  async function uploadAll(): Promise<AttachmentInput[]> {
    if (staged.length === 0) return []
    const supabase = createClientSupabase()
    const out: AttachmentInput[] = []
    for (const { file } of staged) {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${sanitize(file.name)}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      })
      if (upErr) {
        throw new Error(`שגיאה בהעלאת "${file.name}": ${upErr.message}`)
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
      out.push({
        url: pub.publicUrl,
        name: file.name,
        mime: file.type || null,
        size: file.size,
      })
    }
    return out
  }

  async function handleSubmit() {
    setError("")
    if (!startDate) {
      setError("יש לבחור תאריך התחלה")
      return
    }
    if (!endDate) {
      setError("יש לבחור תאריך סיום")
      return
    }
    if (endDate < startDate) {
      setError("תאריך סיום חייב להיות אחרי או שווה לתאריך התחלה")
      return
    }
    if (reason.length > 500) {
      setError("הסיבה ארוכה מדי (מקסימום 500 תווים)")
      return
    }

    setSaving(true)
    try {
      const attachments = await uploadAll()
      const res = await createAbsenceRequest({
        request_type: requestType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
        attachments: attachments.length > 0 ? attachments : undefined,
      })
      if (!res.success) {
        setError(res.error || "שגיאה בשליחת הבקשה")
        toast.error(res.error || "שגיאה בשליחת הבקשה")
        return
      }
      toast.success("הבקשה נשלחה ✓")
      onSaved()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה בשליחת הבקשה"
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const charsLeft = 500 - reason.length

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="בקשת היעדרות חדשה"
      subtitle="חופשה, מחלה, מילואים או היעדרות אחרת"
      widthClass="w-[55%] max-md:w-full"
      noPadding
    >
      <div className="flex flex-col h-full min-h-0 bg-card">
        {/* ── Error banner ── */}
        {error && (
          <div className="mx-4 sm:mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3 shrink-0">
            <Icon name="error" size="sm" className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-red-800">{error}</p>
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Section: type + dates */}
          <div className="bg-accent/50 rounded-[20px] p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">פרטי הבקשה</h3>

            <FormField label="סוג בקשה" required>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as AbsenceRequestType)}
                className={selectClass}
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {REQUEST_TYPE_META[t].emoji} {REQUEST_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="תאריך התחלה" required>
                <DateInput value={startDate} onChange={setStartDate} />
              </FormField>
              <FormField label="תאריך סיום" required>
                <DateInput
                  value={endDate}
                  onChange={setEndDate}
                  minDate={startDate || undefined}
                />
              </FormField>
            </div>

            <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 flex items-center gap-3">
              <Icon name="event_busy" size="sm" className="text-primary" />
              <p className="text-sm font-bold text-foreground">
                סך הכל: <span className="tabular-nums">{totalDays}</span>{" "}
                {totalDays === 1 ? "יום" : "ימים"}
              </p>
            </div>
          </div>

          {/* Section: reason */}
          <div className="bg-accent/50 rounded-[20px] p-4 sm:p-5">
            <FormField label="סיבה (אופציונלי)">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                className={textareaClass}
                rows={3}
                placeholder="פרט/י את הסיבה לבקשה"
              />
              <p className={`text-[11px] mr-1 mt-1 ${charsLeft < 50 ? "text-amber-700" : "text-muted-foreground"}`}>
                נשארו <span className="tabular-nums">{charsLeft}</span> תווים
              </p>
            </FormField>
          </div>

          {/* Section: attachments */}
          <div className="bg-accent/50 rounded-[20px] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">קבצים מצורפים</h3>
              <span className="text-[11px] text-muted-foreground">
                עד 5MB לקובץ
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="min-h-[52px] rounded-xl bg-card border border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 font-bold text-sm text-foreground disabled:opacity-50"
              >
                <Icon name="attach_file" size="sm" />
                בחר קובץ
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={saving}
                className="min-h-[52px] rounded-xl bg-card border border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 font-bold text-sm text-foreground disabled:opacity-50 sm:hidden"
              >
                <Icon name="photo_camera" size="sm" />
                צלם
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ""
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ""
              }}
            />

            {staged.length > 0 && (
              <ul className="space-y-2">
                {staged.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 bg-card border border-border/15 rounded-xl px-3 py-2"
                  >
                    <Icon
                      name={s.file.type.startsWith("image/") ? "image" : "picture_as_pdf"}
                      size="sm"
                      className="text-muted-foreground shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate" title={s.file.name}>
                        {s.file.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {formatBytes(s.file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStaged(s.id)}
                      disabled={saving}
                      aria-label={`הסר את ${s.file.name}`}
                      className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Icon name="close" size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border/15 px-4 sm:px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-start gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-l from-primary to-secondary text-primary-foreground font-bold text-sm shadow-sm hover:opacity-90 transition-opacity min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Icon name="hourglass_empty" size="sm" className="text-primary-foreground animate-spin" />
            ) : (
              <Icon name="send" size="sm" className="text-primary-foreground" />
            )}
            {saving ? "שולח..." : "שלח בקשה"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-border/40 text-muted-foreground font-bold text-sm hover:bg-accent transition-colors min-h-[44px] disabled:opacity-50"
          >
            ביטול
          </button>
        </div>
      </div>
    </SidePanel>
  )
}
