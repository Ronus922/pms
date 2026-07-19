"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Icon } from "@/components/shared/Icon"
import { usePermissions } from "@/lib/hooks/use-tenant"
import {
  getMonthlyAttendanceForAll,
  getMonthlyAttendanceForEmployee,
  getStaffListForAttendance,
  deleteAttendanceEntry,
} from "@/lib/actions/attendance"
import { exportAttendanceToExcel } from "@/lib/actions/attendance-export"
import { bulkImportAttendance } from "@/lib/actions/attendance-import"
import { downloadAttendancePdf } from "@/lib/utils/attendance-pdf-client"
import { downloadBase64 } from "@/lib/utils/reservation-export-client"
import { parseAttendanceXlsx } from "@/lib/utils/attendance-import-client"
import {
  AttendanceEntryPanel,
  ENTRY_TYPE_META,
} from "@/components/attendance/AttendanceEntryPanel"
import type {
  AttendanceRecord,
  AttendanceStaffOption,
  MonthlyAttendanceSummary,
} from "@/lib/types/attendance"

const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

type ExportState = "" | "excel" | "pdf" | "import"

/* ── Constants ───────────────────────────────────────────────── */

const ALL_EMPLOYEES = "__all__"

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
]

const HEBREW_WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]

/* ── Date helpers ────────────────────────────────────────────── */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function weekdayHe(year: number, month: number, day: number): string {
  return HEBREW_WEEKDAYS[new Date(year, month - 1, day).getDay()]
}

function monthOptionsLast12(): { value: string; label: string }[] {
  const now = new Date()
  const opts: { value: string; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    opts.push({
      value: `${y}-${pad2(m)}`,
      label: `${HEBREW_MONTHS[m - 1]} ${y}`,
    })
  }
  return opts
}

function isoToHHMM(iso: string | null | undefined): string {
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

function minutesBetween(startIso: string | null, endIso: string | null): number {
  if (!startIso || !endIso) return 0
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  return Math.max(0, Math.floor((end - start) / 60000))
}

function formatMinutes(total: number): string {
  if (total <= 0) return "00:00"
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${pad2(h)}:${pad2(m)}`
}

function formatHours(total: number): string {
  return (total / 60).toFixed(1)
}

/* ── KPI Card ────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string
  value: string
  icon: string
  tone: "blue" | "green" | "purple" | "orange"
}

const KPI_TONE: Record<KpiCardProps["tone"], { bg: string; text: string; ring: string }> = {
  blue:   { bg: "bg-blue-50",    text: "text-blue-700",    ring: "ring-blue-200" },
  green:  { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  purple: { bg: "bg-violet-50",  text: "text-violet-700",  ring: "ring-violet-200" },
  orange: { bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200" },
}

function KpiCard({ label, value, icon, tone }: KpiCardProps) {
  const t = KPI_TONE[tone]
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 flex items-start gap-4">
      <div className={`shrink-0 w-12 h-12 rounded-2xl ring-1 ${t.bg} ${t.text} ${t.ring} flex items-center justify-center`}>
        <Icon name={icon} size="lg" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        <p className={`text-2xl font-extrabold mt-1 tabular-nums ${t.text}`}>{value}</p>
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────── */

export default function AttendancePage() {
  const { can } = usePermissions()
  const canEdit = can("attendance", "edit")
  const canDelete = can("attendance", "delete")

  /* ── Filters ── */
  const monthOptions = useMemo(() => monthOptionsLast12(), [])
  const [selectedEmployee, setSelectedEmployee] = useState<string>(ALL_EMPLOYEES)
  const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0]?.value ?? "")

  const [year, month] = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number)
    return [y, m]
  }, [selectedMonth])

  /* ── Data ── */
  const [staff, setStaff] = useState<AttendanceStaffOption[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<MonthlyAttendanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>("")

  /* ── Panel state ── */
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<AttendanceRecord | null>(null)
  const [defaultDate, setDefaultDate] = useState<string>("")

  /* Confirm-delete state — id of the row pending confirmation */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  /* Export / import busy state */
  const [busy, setBusy] = useState<ExportState>("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  /* ── Load staff once ── */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getStaffListForAttendance()
      if (cancelled) return
      if (res.success) setStaff(res.data)
      else setLoadError(res.error)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /* ── Load records when filters change ── */
  const loadRecords = useCallback(async () => {
    if (!year || !month) return
    setLoading(true)
    setLoadError("")
    if (selectedEmployee === ALL_EMPLOYEES) {
      const res = await getMonthlyAttendanceForAll(year, month)
      if (res.success) {
        setRecords(res.records)
        setSummary(null)
      } else {
        setLoadError(res.error)
        setRecords([])
        setSummary(null)
      }
    } else {
      const res = await getMonthlyAttendanceForEmployee(selectedEmployee, year, month)
      if (res.success) {
        setRecords(res.records)
        setSummary(res.summary)
      } else {
        setLoadError(res.error)
        setRecords([])
        setSummary(null)
      }
    }
    setLoading(false)
  }, [selectedEmployee, year, month])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  /* ── Panel handlers ── */
  function openCreate(forDate?: string) {
    setEditing(null)
    setDefaultDate(forDate ?? ymd(year, month, 1))
    setPanelOpen(true)
  }

  function openEdit(record: AttendanceRecord) {
    setEditing(record)
    setDefaultDate("")
    setPanelOpen(true)
  }

  async function handleDelete(id: string) {
    const res = await deleteAttendanceEntry(id)
    if (!res.success) {
      setLoadError(res.error || "שגיאה במחיקה")
      return
    }
    setConfirmDeleteId(null)
    void loadRecords()
  }

  /* ── Export / import handlers ─────────────────────────────── */

  const scopeEmployeeId = selectedEmployee === ALL_EMPLOYEES ? undefined : selectedEmployee

  async function handleExportExcel() {
    if (busy) return
    setBusy("excel")
    const res = await exportAttendanceToExcel({ year, month, employeeId: scopeEmployeeId })
    setBusy("")
    if (!res.success || !res.base64 || !res.filename) {
      toast.error(res.error || "שגיאה ביצירת קובץ Excel")
      return
    }
    downloadBase64(res.base64, res.filename, EXCEL_MIME)
    toast.success("קובץ ה-Excel הורד")
  }

  async function handleExportPdf() {
    if (busy) return
    setBusy("pdf")
    const res = await downloadAttendancePdf({ year, month, employeeId: scopeEmployeeId })
    setBusy("")
    if (!res.success) {
      toast.error(res.error || "שגיאה ביצירת PDF")
      return
    }
    toast.success("קובץ ה-PDF הורד")
  }

  function handleImportClick() {
    if (busy) return
    fileInputRef.current?.click()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file later
    if (!file) return
    setBusy("import")
    try {
      const parsed = await parseAttendanceXlsx(file)
      if (parsed.fatalError) {
        toast.error(parsed.fatalError)
        return
      }
      if (parsed.rows.length === 0) {
        toast.error("לא נמצאו שורות נתונים בקובץ")
        return
      }
      const res = await bulkImportAttendance({
        defaultEmployeeId: scopeEmployeeId,
        rows: parsed.rows,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (res.errorCount > 0) {
        const summary =
          res.insertedCount > 0
            ? `יובאו ${res.insertedCount} שורות, ${res.errorCount} נכשלו`
            : `כל ${res.errorCount} השורות נכשלו`
        toast.warning(summary, {
          description: res.errors.slice(0, 5).map((e) => `שורה ${e.rowNumber}: ${e.message}`).join("\n"),
          duration: 8000,
        })
      } else {
        toast.success(`יובאו ${res.insertedCount} שורות בהצלחה`)
      }
      void loadRecords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בקריאת הקובץ")
    } finally {
      setBusy("")
    }
  }

  /* ── Pre-compute per-day groups for single-employee view ── */
  const employeeDayRows = useMemo(() => {
    if (selectedEmployee === ALL_EMPLOYEES) return null
    const total = daysInMonth(year, month)
    const byDate = new Map<string, AttendanceRecord[]>()
    for (const r of records) {
      const arr = byDate.get(r.work_date) ?? []
      arr.push(r)
      byDate.set(r.work_date, arr)
    }
    const out: { date: string; day: number; records: AttendanceRecord[] }[] = []
    for (let d = 1; d <= total; d++) {
      const date = ymd(year, month, d)
      out.push({ date, day: d, records: byDate.get(date) ?? [] })
    }
    return out
  }, [records, selectedEmployee, year, month])

  /* ── Pre-compute all-employees rows (one per record) ── */
  const allRows = useMemo(() => {
    if (selectedEmployee !== ALL_EMPLOYEES) return null
    return records
  }, [records, selectedEmployee])

  const isSingle = selectedEmployee !== ALL_EMPLOYEES

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="bg-gradient-to-l from-primary/10 to-secondary/10 rounded-[20px] p-6 border border-border/15 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground flex items-center justify-center shadow-md">
            <Icon name="schedule" size="lg" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold font-headline text-foreground">
              ניהול נוכחות
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              צפייה ועריכת שעות עבודה של העובדים
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <button
              type="button"
              onClick={handleImportClick}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/40 bg-card text-sm font-bold text-foreground hover:bg-accent transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === "import" ? (
                <Icon name="hourglass_empty" size="sm" className="animate-spin" />
              ) : (
                <Icon name="upload" size="sm" />
              )}
              {busy === "import" ? "מייבא..." : "ייבוא מאקסל"}
            </button>
          )}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!!busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/40 bg-card text-sm font-bold text-foreground hover:bg-accent transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "pdf" ? (
              <Icon name="hourglass_empty" size="sm" className="animate-spin" />
            ) : (
              <Icon name="picture_as_pdf" size="sm" />
            )}
            {busy === "pdf" ? "מייצא..." : "ייצוא PDF"}
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!!busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/40 bg-card text-sm font-bold text-foreground hover:bg-accent transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "excel" ? (
              <Icon name="hourglass_empty" size="sm" className="animate-spin" />
            ) : (
              <Icon name="download" size="sm" />
            )}
            {busy === "excel" ? "מייצא..." : "ייצוא לאקסל"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="bg-card rounded-[20px] border border-border/15 p-6">
        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mr-1 mb-2">
              עובד
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full bg-accent border-0 rounded-xl px-5 py-3.5 pe-10 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer min-h-[48px] select-arrow"
            >
              <option value={ALL_EMPLOYEES}>כל העובדים</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mr-1 mb-2">
              חודש
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-accent border-0 rounded-xl px-5 py-3.5 pe-10 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer min-h-[48px] select-arrow"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Icon name="error" size="sm" className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-red-800">{loadError}</p>
        </div>
      )}

      {/* ─── Single-employee summary ─── */}
      {isSingle && summary && !loading && (
        <>
          <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <KpiCard
              label="ימי עבודה"
              value={String(summary.work_days)}
              icon="event_available"
              tone="blue"
            />
            <KpiCard
              label="שעות עבודה"
              value={formatHours(summary.total_minutes)}
              icon="schedule"
              tone="green"
            />
            <KpiCard
              label="ממוצע ליום"
              value={formatHours(summary.avg_minutes_per_day)}
              icon="trending_up"
              tone="purple"
            />
            <KpiCard
              label="שעות נוספות"
              value={formatHours(summary.overtime_minutes)}
              icon="bolt"
              tone="orange"
            />
          </div>

          {summary.issues.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-[20px] px-5 py-4 flex items-center gap-3">
              <Icon name="check_circle" size="md" className="text-emerald-600" />
              <p className="text-sm font-bold text-emerald-800">
                אין בעיות בחודש זה
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-[20px] px-5 py-4">
              <div className="flex items-center gap-3 mb-2">
                <Icon name="warning" size="md" className="text-amber-600" />
                <p className="text-sm font-bold text-amber-800">
                  נמצאו {summary.issues.length} בעיות בחודש
                </p>
              </div>
              <ul className="list-disc pr-6 space-y-1">
                {summary.issues.map((msg, i) => (
                  <li key={i} className="text-sm text-amber-800">{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* ─── Table ─── */}
      <div className="bg-card rounded-[20px] border border-border/15 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
            <p className="text-sm font-medium">טוען נוכחות...</p>
          </div>
        ) : isSingle ? (
          <SingleEmployeeTable
            rows={employeeDayRows ?? []}
            canEdit={canEdit}
            canDelete={canDelete}
            onCreate={openCreate}
            onEdit={openEdit}
            onDelete={(id) => setConfirmDeleteId(id)}
            confirmDeleteId={confirmDeleteId}
            onConfirmDelete={handleDelete}
            onCancelDelete={() => setConfirmDeleteId(null)}
          />
        ) : (
          <AllEmployeesTable
            rows={allRows ?? []}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={openEdit}
            onDelete={(id) => setConfirmDeleteId(id)}
            confirmDeleteId={confirmDeleteId}
            onConfirmDelete={handleDelete}
            onCancelDelete={() => setConfirmDeleteId(null)}
          />
        )}
      </div>

      {/* ─── SidePanel ─── */}
      <AttendanceEntryPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSaved={loadRecords}
        record={editing}
        defaultDate={defaultDate}
        lockedUserId={isSingle ? selectedEmployee : undefined}
        defaultUserId={isSingle ? selectedEmployee : undefined}
        staffOptions={staff}
      />
    </div>
  )
}

/* ── Single-employee table ───────────────────────────────────── */

interface SingleEmployeeTableProps {
  rows: { date: string; day: number; records: AttendanceRecord[] }[]
  canEdit: boolean
  canDelete: boolean
  onCreate: (date: string) => void
  onEdit: (record: AttendanceRecord) => void
  onDelete: (id: string) => void
  confirmDeleteId: string | null
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}

function SingleEmployeeTable({
  rows,
  canEdit,
  canDelete,
  onCreate,
  onEdit,
  onDelete,
  confirmDeleteId,
  onConfirmDelete,
  onCancelDelete,
}: SingleEmployeeTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Icon name="event_busy" size="xl" className="opacity-30" />
        <p className="text-sm font-medium">אין רישומים בחודש זה</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-accent/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-right font-bold">תאריך</th>
            <th className="px-4 py-3 text-right font-bold">יום</th>
            <th className="px-4 py-3 text-right font-bold">שעת הגעה</th>
            <th className="px-4 py-3 text-right font-bold">שעת יציאה</th>
            <th className="px-4 py-3 text-right font-bold">סה&quot;כ שעות</th>
            <th className="px-4 py-3 text-right font-bold">פעולות</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/15">
          {rows.map(({ date, day, records }) => {
            if (records.length === 0) {
              return (
                <tr key={date} className="hover:bg-accent/30">
                  <td className="px-4 py-3 tabular-nums">{date}</td>
                  <td className="px-4 py-3">{weekdayHe(Number(date.slice(0, 4)), Number(date.slice(5, 7)), day)}</td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onCreate(date)}
                        aria-label="הוסף רישום"
                        className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <Icon name="add" size="sm" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            }

            return records.map((rec, idx) => {
              const isNonRegular = rec.entry_type !== "regular"
              const rowBg = isNonRegular ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/30"
              const minutes = rec.entry_type === "regular" ? minutesBetween(rec.clock_in, rec.clock_out) : 0
              const isConfirming = confirmDeleteId === rec.id
              return (
                <tr key={rec.id} className={rowBg}>
                  <td className="px-4 py-3 tabular-nums">{idx === 0 ? date : ""}</td>
                  <td className="px-4 py-3">{idx === 0 ? weekdayHe(Number(date.slice(0, 4)), Number(date.slice(5, 7)), day) : ""}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>
                    {isNonRegular ? "—" : (isoToHHMM(rec.clock_in) || "—")}
                  </td>
                  <td className="px-4 py-3 tabular-nums" dir="ltr" style={{ textAlign: "right" }}>
                    {isNonRegular ? (
                      <span className="text-muted-foreground">—</span>
                    ) : rec.clock_out ? (
                      isoToHHMM(rec.clock_out)
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                        <Icon name="schedule" size="sm" />
                        פתוחה
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ textAlign: "right" }}>
                    {isNonRegular ? (
                      <EntryTypeBadge type={rec.entry_type} />
                    ) : rec.clock_out ? (
                      <span className="tabular-nums" dir="ltr">{formatMinutes(minutes)}</span>
                    ) : (
                      <span className="tabular-nums text-muted-foreground" dir="ltr">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      record={rec}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      isConfirming={isConfirming}
                      onConfirmDelete={onConfirmDelete}
                      onCancelDelete={onCancelDelete}
                    />
                  </td>
                </tr>
              )
            })
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── All-employees table ─────────────────────────────────────── */

interface AllEmployeesTableProps {
  rows: AttendanceRecord[]
  canEdit: boolean
  canDelete: boolean
  onEdit: (record: AttendanceRecord) => void
  onDelete: (id: string) => void
  confirmDeleteId: string | null
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}

function AllEmployeesTable({
  rows,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  confirmDeleteId,
  onConfirmDelete,
  onCancelDelete,
}: AllEmployeesTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Icon name="event_busy" size="xl" className="opacity-30" />
        <p className="text-sm font-medium">אין רישומים בחודש זה</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-accent/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-right font-bold">תאריך</th>
            <th className="px-4 py-3 text-right font-bold">יום</th>
            <th className="px-4 py-3 text-right font-bold">עובד</th>
            <th className="px-4 py-3 text-right font-bold">שעת הגעה</th>
            <th className="px-4 py-3 text-right font-bold">שעת יציאה</th>
            <th className="px-4 py-3 text-right font-bold">סה&quot;כ שעות</th>
            <th className="px-4 py-3 text-right font-bold">פעולות</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/15">
          {rows.map((rec) => {
            const isNonRegular = rec.entry_type !== "regular"
            const rowBg = isNonRegular ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/30"
            const y = Number(rec.work_date.slice(0, 4))
            const m = Number(rec.work_date.slice(5, 7))
            const d = Number(rec.work_date.slice(8, 10))
            const minutes = rec.entry_type === "regular" ? minutesBetween(rec.clock_in, rec.clock_out) : 0
            const isConfirming = confirmDeleteId === rec.id
            return (
              <tr key={rec.id} className={rowBg}>
                <td className="px-4 py-3 tabular-nums">{rec.work_date}</td>
                <td className="px-4 py-3">{weekdayHe(y, m, d)}</td>
                <td className="px-4 py-3 font-medium">{rec.user_name ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>
                  {isNonRegular ? "—" : (isoToHHMM(rec.clock_in) || "—")}
                </td>
                <td className="px-4 py-3 tabular-nums" dir="ltr" style={{ textAlign: "right" }}>
                  {isNonRegular ? (
                    <span className="text-muted-foreground">—</span>
                  ) : rec.clock_out ? (
                    isoToHHMM(rec.clock_out)
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                      <Icon name="schedule" size="sm" />
                      פתוחה
                    </span>
                  )}
                </td>
                <td className="px-4 py-3" style={{ textAlign: "right" }}>
                  {isNonRegular ? (
                    <EntryTypeBadge type={rec.entry_type} />
                  ) : rec.clock_out ? (
                    <span className="tabular-nums" dir="ltr">{formatMinutes(minutes)}</span>
                  ) : (
                    <span className="tabular-nums text-muted-foreground" dir="ltr">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    record={rec}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    isConfirming={isConfirming}
                    onConfirmDelete={onConfirmDelete}
                    onCancelDelete={onCancelDelete}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Row actions (edit + delete with inline confirm) ─────────── */

interface RowActionsProps {
  record: AttendanceRecord
  canEdit: boolean
  canDelete: boolean
  onEdit: (record: AttendanceRecord) => void
  onDelete: (id: string) => void
  isConfirming: boolean
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}

function RowActions({
  record,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  isConfirming,
  onConfirmDelete,
  onCancelDelete,
}: RowActionsProps) {
  if (isConfirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onConfirmDelete(record.id)}
          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors min-h-[44px]"
        >
          <Icon name="delete" size="sm" />
          אישור מחיקה
        </button>
        <button
          type="button"
          onClick={onCancelDelete}
          className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-border/40 text-xs font-bold text-muted-foreground hover:bg-accent transition-colors min-h-[44px]"
        >
          ביטול
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {canEdit && (
        <button
          type="button"
          onClick={() => onEdit(record)}
          aria-label="ערוך רישום"
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Icon name="edit" size="sm" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(record.id)}
          aria-label="מחק רישום"
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
        >
          <Icon name="delete" size="sm" />
        </button>
      )}
    </div>
  )
}

/* ── Non-regular row badge (used inside the total-hours column) ─ */

function EntryTypeBadge({ type }: { type: AttendanceRecord["entry_type"] }) {
  const meta = ENTRY_TYPE_META[type]
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold whitespace-nowrap">
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  )
}
