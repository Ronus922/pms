"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Icon } from "@/components/shared/Icon"
import {
  cancelMyAbsenceRequest,
  listMyAbsenceRequests,
} from "@/lib/actions/absence-requests"
import {
  CreateAbsenceRequestPanel,
  REQUEST_TYPE_META,
} from "@/components/absence-requests/CreateAbsenceRequestPanel"
import type {
  AbsenceRequest,
  AbsenceRequestStatus,
} from "@/lib/types/absence-requests"

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

/* ── Helpers ────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  // YYYY-MM-DD → DD/MM/YYYY
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

function formatRange(start: string, end: string): string {
  if (start === end) return formatDate(start)
  return `${formatDate(start)} — ${formatDate(end)}`
}

function thisMonthBucket(iso: string | null): { y: number; m: number } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
}

/* ── Page ───────────────────────────────────────────────────── */

export default function MyAbsenceRequestsPage() {
  const [requests, setRequests] = useState<AbsenceRequest[]>([])
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>("")

  const [createOpen, setCreateOpen] = useState(false)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const rows = await listMyAbsenceRequests()
      setRequests(rows)
      // attachments_count isn't in AbsenceRequest (manager-only join);
      // for the worker view, we'll surface "has attachment?" only when
      // the row's `reason` mentions one — but since this page reads from
      // listMyAbsenceRequests which doesn't join attachments, leave the
      // count map empty for now. (Wired through here so we can fill it
      // later without restructuring the table.)
      setAttachmentCounts({})
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "שגיאה בטעינת הבקשות")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const now = new Date()
    const thisY = now.getUTCFullYear()
    const thisM = now.getUTCMonth()
    let pending = 0
    let approvedThisMonth = 0
    let rejectedThisMonth = 0
    for (const r of requests) {
      if (r.status === "pending") pending++
      if (r.status === "approved" || r.status === "rejected") {
        const b = thisMonthBucket(r.reviewed_at) ?? thisMonthBucket(r.created_at)
        if (b && b.y === thisY && b.m === thisM) {
          if (r.status === "approved") approvedThisMonth++
          else rejectedThisMonth++
        }
      }
    }
    return { pending, approvedThisMonth, rejectedThisMonth }
  }, [requests])

  /* ── Handlers ── */
  async function handleCancel(id: string) {
    setCancellingId(id)
    const res = await cancelMyAbsenceRequest(id)
    setCancellingId(null)
    if (!res.success) {
      toast.error(res.error || "שגיאה בביטול")
      return
    }
    setConfirmCancelId(null)
    toast.success("הבקשה בוטלה")
    void load()
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-gradient-to-l from-[#003aa0]/10 to-[#3F51B5]/10 rounded-[20px] p-4 sm:p-6 border border-border/15 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#003aa0] to-[#3F51B5] text-white flex items-center justify-center shadow-md">
            <Icon name="event_busy" size="lg" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-headline text-foreground">
              הבקשות שלי
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ניהול בקשות חופשה, מחלה ומילואים
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white font-bold text-sm shadow-md hover:opacity-90 transition-opacity min-h-[44px] w-full sm:w-auto"
        >
          <Icon name="add_circle" size="sm" className="text-white" />
          בקשה חדשה
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label="ממתינות לאישור"
          value={kpis.pending}
          icon="schedule"
          tone="amber"
        />
        <KpiCard
          label="אושרו (החודש)"
          value={kpis.approvedThisMonth}
          icon="check_circle"
          tone="green"
        />
        <KpiCard
          label="נדחו (החודש)"
          value={kpis.rejectedThisMonth}
          icon="cancel"
          tone="red"
        />
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
            <Icon name="event_busy" size="xl" className="opacity-30" />
            <p className="text-lg font-medium">אין בקשות עדיין</p>
            <p className="text-sm text-center">
              לחצ/י על "בקשה חדשה" כדי להגיש את הבקשה הראשונה שלך.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards (< sm) */}
            <ul className="sm:hidden divide-y divide-border/15">
              {requests.map((r) => (
                <li key={r.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <TypeBadge type={r.request_type} />
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {formatRange(r.start_date, r.end_date)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular-nums">{r.total_days}</span>{" "}
                      {r.total_days === 1 ? "יום" : "ימים"}
                      {attachmentCounts[r.id] ? (
                        <>
                          {" · "}
                          <Icon name="attach_file" size="sm" className="inline align-middle" />{" "}
                          <span className="tabular-nums">{attachmentCounts[r.id]}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {r.review_note && (
                    <p className="text-xs text-muted-foreground bg-accent/40 rounded-lg px-3 py-2">
                      <span className="font-bold">הערת מאשר: </span>
                      {r.review_note}
                    </p>
                  )}
                  {r.status === "pending" && (
                    <CancelControl
                      id={r.id}
                      isConfirming={confirmCancelId === r.id}
                      isCancelling={cancellingId === r.id}
                      onAsk={() => setConfirmCancelId(r.id)}
                      onCancel={() => setConfirmCancelId(null)}
                      onConfirm={() => handleCancel(r.id)}
                    />
                  )}
                </li>
              ))}
            </ul>

            {/* Desktop table (≥ sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-accent/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right font-bold">סוג</th>
                    <th className="px-4 py-3 text-right font-bold">תאריכים</th>
                    <th className="px-4 py-3 text-right font-bold">סך ימים</th>
                    <th className="px-4 py-3 text-right font-bold">סטטוס</th>
                    <th className="px-4 py-3 text-right font-bold">הערת מאשר</th>
                    <th className="px-4 py-3 text-right font-bold">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/15">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <TypeBadge type={r.request_type} />
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <div className="flex items-center gap-2">
                          <span>{formatRange(r.start_date, r.end_date)}</span>
                          {attachmentCounts[r.id] ? (
                            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Icon name="attach_file" size="sm" />
                              <span className="tabular-nums">{attachmentCounts[r.id]}</span>
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-medium">{r.total_days}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                        <span className="line-clamp-2">{r.review_note || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "pending" ? (
                          <CancelControl
                            id={r.id}
                            isConfirming={confirmCancelId === r.id}
                            isCancelling={cancellingId === r.id}
                            onAsk={() => setConfirmCancelId(r.id)}
                            onCancel={() => setConfirmCancelId(null)}
                            onConfirm={() => handleCancel(r.id)}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Create panel ── */}
      <CreateAbsenceRequestPanel
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={load}
      />
    </div>
  )
}

/* ── KPI card ───────────────────────────────────────────────── */

interface KpiCardProps {
  label: string
  value: number
  icon: string
  tone: "amber" | "green" | "red"
}

const KPI_TONE: Record<KpiCardProps["tone"], { bg: string; text: string; ring: string }> = {
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

function TypeBadge({ type }: { type: AbsenceRequest["request_type"] }) {
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

/* ── Cancel inline confirm ──────────────────────────────────── */

interface CancelControlProps {
  id: string
  isConfirming: boolean
  isCancelling: boolean
  onAsk: () => void
  onCancel: () => void
  onConfirm: () => void
}

function CancelControl({
  isConfirming,
  isCancelling,
  onAsk,
  onCancel,
  onConfirm,
}: CancelControlProps) {
  if (isConfirming) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isCancelling}
          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors min-h-[44px] disabled:opacity-50"
        >
          {isCancelling ? (
            <Icon name="hourglass_empty" size="sm" className="animate-spin" />
          ) : (
            <Icon name="block" size="sm" />
          )}
          {isCancelling ? "מבטל..." : "אישור ביטול"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-border/40 text-xs font-bold text-muted-foreground hover:bg-accent transition-colors min-h-[44px] disabled:opacity-50"
        >
          חזרה
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onAsk}
      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 transition-colors min-h-[44px]"
    >
      <Icon name="block" size="sm" />
      בטל בקשה
    </button>
  )
}
