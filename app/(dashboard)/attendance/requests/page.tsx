"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { usePermissions } from "@/lib/hooks/use-tenant"
import { listAllAbsenceRequests } from "@/lib/actions/absence-requests"
import { getStaffListForAttendance } from "@/lib/actions/attendance"
import { REQUEST_TYPE_META } from "@/components/absence-requests/CreateAbsenceRequestPanel"
import { ReviewAbsenceRequestPanel } from "@/components/absence-requests/ReviewAbsenceRequestPanel"
import type {
  AbsenceRequestStatus,
  AbsenceRequestType,
  AbsenceRequestWithEmployee,
  ListAbsenceRequestsFilters,
} from "@/lib/types/absence-requests"
import type { AttendanceStaffOption } from "@/lib/types/attendance"

/* ── Status catalog ─────────────────────────────────────────── */

const STATUS_META: Record<
  AbsenceRequestStatus,
  { label: string; classes: string; icon: string }
> = {
  pending:   { label: "ממתינה",  classes: "bg-amber-50 text-amber-800 border-amber-200",      icon: "schedule" },
  approved:  { label: "אושרה",   classes: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "check_circle" },
  rejected:  { label: "נדחתה",   classes: "bg-red-50 text-red-800 border-red-200",            icon: "cancel" },
  cancelled: { label: "בוטלה",   classes: "bg-gray-100 text-gray-700 border-gray-200",        icon: "block" },
}

const TYPE_ORDER: AbsenceRequestType[] = [
  "vacation", "sick", "reserve_duty", "personal", "unpaid", "other",
]

const STATUS_FILTER_OPTIONS: { value: "all" | AbsenceRequestStatus; label: string }[] = [
  { value: "all",       label: "כל הסטטוסים" },
  { value: "pending",   label: "ממתינות" },
  { value: "approved",  label: "אושרו" },
  { value: "rejected",  label: "נדחו" },
  { value: "cancelled", label: "בוטלו" },
]

const ALL = "__all__"

/* ── Helpers ────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

function formatRange(start: string, end: string): string {
  if (start === end) return formatDate(start)
  return `${formatDate(start)} — ${formatDate(end)}`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  }).format(d)
}

const SELECT_CLASS =
  "w-full bg-accent border-0 rounded-xl px-5 py-3.5 pe-10 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer min-h-[48px] select-arrow"

/* ── Page ───────────────────────────────────────────────────── */

export default function AbsenceRequestsManagerPage() {
  const { can } = usePermissions()
  const canEdit = can("absence_requests", "edit")

  /* ── Filters ── */
  const [statusFilter, setStatusFilter] = useState<"all" | AbsenceRequestStatus>("pending")
  const [employeeFilter, setEmployeeFilter] = useState<string>(ALL)
  const [typeFilter, setTypeFilter] = useState<"all" | AbsenceRequestType>("all")

  /* ── Data ── */
  const [staff, setStaff] = useState<AttendanceStaffOption[]>([])
  const [requests, setRequests] = useState<AbsenceRequestWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>("")

  /* ── Panel ── */
  const [selectedRequest, setSelectedRequest] = useState<AbsenceRequestWithEmployee | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  /* ── Load staff once ── */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getStaffListForAttendance()
      if (cancelled) return
      if (res.success) setStaff(res.data)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /* ── Load requests when filters change ── */
  const loadRequests = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    const filters: ListAbsenceRequestsFilters = {}
    if (statusFilter !== "all") filters.status = statusFilter
    if (employeeFilter !== ALL) filters.employee_id = employeeFilter
    const res = await listAllAbsenceRequests(filters)
    if (res.success) {
      // The action doesn't filter by request_type — narrow client-side.
      const filtered =
        typeFilter === "all"
          ? res.data
          : res.data.filter((r) => r.request_type === typeFilter)
      setRequests(filtered)
    } else {
      setLoadError(res.error)
      setRequests([])
    }
    setLoading(false)
  }, [statusFilter, employeeFilter, typeFilter])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  /* ── KPIs (computed over the unfiltered total — we re-query without
   *    filters? No — the user reads totals from the filtered view since
   *    they're the row counts. Simpler + intuitively matches the table.) ── */
  const kpis = useMemo(() => {
    const total = requests.length
    let pending = 0
    let approved = 0
    let rejected = 0
    for (const r of requests) {
      if (r.status === "pending") pending++
      else if (r.status === "approved") approved++
      else if (r.status === "rejected") rejected++
    }
    return { total, pending, approved, rejected }
  }, [requests])

  function openPanel(request: AbsenceRequestWithEmployee) {
    setSelectedRequest(request)
    setPanelOpen(true)
  }

  /* ── Render ── */

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-gradient-to-l from-[#003aa0]/10 to-[#3F51B5]/10 rounded-[20px] p-4 sm:p-6 border border-border/15 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#003aa0] to-[#3F51B5] text-white flex items-center justify-center shadow-md">
            <Icon name="fact_check" size="lg" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-headline text-foreground">
              בקשות היעדרות
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ניהול ואישור בקשות עובדים
            </p>
          </div>
        </div>

        {kpis.pending > 0 && (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-sm font-bold whitespace-nowrap">
            <Icon name="schedule" size="sm" />
            <span className="tabular-nums">{kpis.pending}</span> ממתינות לאישור
          </span>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="סך הכל"  value={kpis.total}    icon="inbox"         tone="blue"  />
        <KpiCard label="ממתינות" value={kpis.pending}  icon="schedule"      tone="amber" />
        <KpiCard label="אושרו"   value={kpis.approved} icon="check_circle"  tone="green" />
        <KpiCard label="נדחו"    value={kpis.rejected} icon="cancel"        tone="red"   />
      </div>

      {/* ── Filters ── */}
      <div className="bg-card rounded-[20px] border border-border/15 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mr-1 mb-2">
              סטטוס
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | AbsenceRequestStatus)
              }
              className={SELECT_CLASS}
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mr-1 mb-2">
              עובד
            </label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value={ALL}>כל העובדים</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mr-1 mb-2">
              סוג
            </label>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "all" | AbsenceRequestType)
              }
              className={SELECT_CLASS}
            >
              <option value="all">כל הסוגים</option>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {REQUEST_TYPE_META[t].emoji} {REQUEST_TYPE_META[t].label}
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

      {/* ── Content ── */}
      <div className="bg-card rounded-[20px] border border-border/15 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
            <p className="text-sm font-medium">טוען...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 px-4">
            <Icon name="inbox" size="xl" className="opacity-30" />
            <p className="text-lg font-medium">לא נמצאו בקשות</p>
            <p className="text-sm text-center">
              נסה לשנות את המסננים או חזור מאוחר יותר.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards (< sm) */}
            <ul className="sm:hidden divide-y divide-border/15">
              {requests.map((r) => (
                <li key={r.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-foreground">{r.employee_name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                        {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <TypeBadge type={r.request_type} />
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {formatRange(r.start_date, r.end_date)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({r.total_days} {r.total_days === 1 ? "יום" : "ימים"})
                    </span>
                    {r.attachments_count > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Icon name="attach_file" size="sm" />
                        <span className="tabular-nums">{r.attachments_count}</span>
                      </span>
                    )}
                  </div>
                  {r.reason && (
                    <p className="text-xs text-muted-foreground line-clamp-2 bg-accent/40 rounded-lg px-3 py-2">
                      {r.reason}
                    </p>
                  )}
                  <MobileActions
                    request={r}
                    canEdit={canEdit}
                    onOpen={() => openPanel(r)}
                  />
                </li>
              ))}
            </ul>

            {/* Desktop table (≥ sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-accent/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right font-bold">עובד</th>
                    <th className="px-4 py-3 text-right font-bold">סוג</th>
                    <th className="px-4 py-3 text-right font-bold">תאריכים</th>
                    <th className="px-4 py-3 text-right font-bold">סך ימים</th>
                    <th className="px-4 py-3 text-right font-bold">סיבה</th>
                    <th className="px-4 py-3 text-right font-bold">קבצים</th>
                    <th className="px-4 py-3 text-right font-bold">סטטוס</th>
                    <th className="px-4 py-3 text-right font-bold">תאריך הגשה</th>
                    <th className="px-4 py-3 text-right font-bold">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/15">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-accent/30">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {r.employee_name}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={r.request_type} />
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatRange(r.start_date, r.end_date)}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-bold">{r.total_days}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                        <span className="line-clamp-2">{r.reason || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.attachments_count > 0 ? (
                          <button
                            type="button"
                            onClick={() => openPanel(r)}
                            className="inline-flex items-center gap-1 text-primary hover:underline tabular-nums"
                          >
                            <Icon name="attach_file" size="sm" />
                            {r.attachments_count}
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <DesktopActions
                          request={r}
                          canEdit={canEdit}
                          onOpen={() => openPanel(r)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Review panel ── */}
      <ReviewAbsenceRequestPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onReviewed={loadRequests}
        request={selectedRequest}
      />
    </div>
  )
}

/* ── KPI card ───────────────────────────────────────────────── */

interface KpiCardProps {
  label: string
  value: number
  icon: string
  tone: "blue" | "amber" | "green" | "red"
}

const KPI_TONE: Record<KpiCardProps["tone"], { bg: string; text: string; ring: string }> = {
  blue:  { bg: "bg-blue-50",     text: "text-blue-700",     ring: "ring-blue-200" },
  amber: { bg: "bg-amber-50",    text: "text-amber-700",    ring: "ring-amber-200" },
  green: { bg: "bg-emerald-50",  text: "text-emerald-700",  ring: "ring-emerald-200" },
  red:   { bg: "bg-red-50",      text: "text-red-700",      ring: "ring-red-200" },
}

function KpiCard({ label, value, icon, tone }: KpiCardProps) {
  const t = KPI_TONE[tone]
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-3 sm:p-4 flex flex-col items-start gap-2 min-w-0">
      <div className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl ring-1 ${t.bg} ${t.text} ${t.ring} flex items-center justify-center`}>
        <Icon name={icon} size="sm" />
      </div>
      <p className="text-[11px] sm:text-xs font-bold text-muted-foreground leading-tight w-full break-words">
        {label}
      </p>
      <p className={`text-xl sm:text-2xl font-extrabold tabular-nums leading-none ${t.text}`}>
        {value}
      </p>
    </div>
  )
}

/* ── Badges ─────────────────────────────────────────────────── */

function TypeBadge({ type }: { type: AbsenceRequestType }) {
  const meta = REQUEST_TYPE_META[type]
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold whitespace-nowrap">
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: AbsenceRequestStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${meta.classes}`}
    >
      <Icon name={meta.icon} size="sm" />
      {meta.label}
    </span>
  )
}

/* ── Row actions ────────────────────────────────────────────── */

interface ActionsProps {
  request: AbsenceRequestWithEmployee
  canEdit: boolean
  onOpen: () => void
}

function DesktopActions({ request, canEdit, onOpen }: ActionsProps) {
  if (request.status === "pending" && canEdit) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors min-h-[44px]"
        >
          <Icon name="check_circle" size="sm" />
          אשר
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors min-h-[44px]"
        >
          <Icon name="cancel" size="sm" />
          דחה
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="צפה בפרטים"
      className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      <Icon name="visibility" size="sm" />
    </button>
  )
}

function MobileActions({ request, canEdit, onOpen }: ActionsProps) {
  if (request.status === "pending" && canEdit) {
    return (
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors min-h-[44px]"
        >
          <Icon name="check_circle" size="sm" />
          אשר
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors min-h-[44px]"
        >
          <Icon name="cancel" size="sm" />
          דחה
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border/40 text-foreground text-xs font-bold hover:bg-accent transition-colors min-h-[44px]"
    >
      <Icon name="visibility" size="sm" />
      צפה בפרטים
    </button>
  )
}
