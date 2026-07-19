"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { FormField, textareaClass } from "@/components/shared/FormField"
import {
  getAbsenceRequestAttachments,
  reviewAbsenceRequest,
} from "@/lib/actions/absence-requests"
import { REQUEST_TYPE_META } from "@/components/absence-requests/CreateAbsenceRequestPanel"
import type {
  AbsenceRequestAttachment,
  AbsenceRequestStatus,
  AbsenceRequestWithEmployee,
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

function formatBytes(n: number | null): string {
  if (n == null || n <= 0) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/")
}

/* ── Props ──────────────────────────────────────────────────── */

interface ReviewAbsenceRequestPanelProps {
  isOpen: boolean
  onClose: () => void
  onReviewed: () => void
  /** The full row from the manager list; drives both view + decision modes. */
  request: AbsenceRequestWithEmployee | null
}

/* ── Component ──────────────────────────────────────────────── */

export function ReviewAbsenceRequestPanel({
  isOpen,
  onClose,
  onReviewed,
  request,
}: ReviewAbsenceRequestPanelProps) {
  const isPending = request?.status === "pending"

  const [reviewNote, setReviewNote] = useState<string>("")
  const [submitting, setSubmitting] = useState<"" | "approved" | "rejected">("")
  const [error, setError] = useState<string>("")

  /* Attachment list — loaded lazily on open. */
  const [attachments, setAttachments] = useState<AbsenceRequestAttachment[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)

  const loadAttachments = useCallback(async (id: string) => {
    setLoadingAttachments(true)
    const res = await getAbsenceRequestAttachments(id)
    setLoadingAttachments(false)
    if (res.success) setAttachments(res.data)
    else setAttachments([])
  }, [])

  useEffect(() => {
    if (!isOpen || !request) return
    setReviewNote("")
    setSubmitting("")
    setError("")
    setAttachments([])
    if ((request.attachments_count ?? 0) > 0) {
      void loadAttachments(request.id)
    }
  }, [isOpen, request, loadAttachments])

  async function handleSubmit(status: "approved" | "rejected") {
    if (!request) return
    if (reviewNote.length > 500) {
      setError("ההערה ארוכה מדי (מקסימום 500 תווים)")
      return
    }
    setError("")
    setSubmitting(status)
    const res = await reviewAbsenceRequest(request.id, {
      status,
      review_note: reviewNote.trim() || null,
    })
    setSubmitting("")
    if (!res.success) {
      setError(res.error || "שגיאה בעדכון הבקשה")
      toast.error(res.error || "שגיאה בעדכון הבקשה")
      return
    }
    if (status === "approved") {
      const n = res.createdRecords ?? 0
      toast.success(`הבקשה אושרה. נוצרו ${n} רישומי נוכחות.`)
    } else {
      toast.success("הבקשה נדחתה")
    }
    onReviewed()
    onClose()
  }

  if (!request) return null

  const typeMeta = REQUEST_TYPE_META[request.request_type]
  const statusMeta = STATUS_META[request.status]
  const charsLeft = 500 - reviewNote.length

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isPending ? "סקירת בקשה" : "פרטי בקשה"}
      subtitle={request.employee_name}
      widthClass="w-[50%] max-md:w-full"
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
          {/* Identity + status */}
          <div className="bg-accent/50 rounded-[20px] p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-muted-foreground">עובד</h3>
                <p className="text-lg font-extrabold text-foreground mt-1">
                  {request.employee_name}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${statusMeta.classes}`}
              >
                <Icon name={statusMeta.icon} size="sm" />
                {statusMeta.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoCell label="סוג">
                <span className="inline-flex items-center gap-1.5 text-foreground font-bold">
                  <span aria-hidden>{typeMeta.emoji}</span>
                  {typeMeta.label}
                </span>
              </InfoCell>
              <InfoCell label="תאריכים">
                <span className="tabular-nums font-bold text-foreground">
                  {formatRange(request.start_date, request.end_date)}
                </span>
              </InfoCell>
              <InfoCell label="סך הכל">
                <span className="tabular-nums font-bold text-foreground">
                  {request.total_days} {request.total_days === 1 ? "יום" : "ימים"}
                </span>
              </InfoCell>
            </div>

            <InfoCell label="תאריך הגשה">
              <span className="tabular-nums text-foreground">
                {formatDateTime(request.created_at)}
              </span>
            </InfoCell>
          </div>

          {/* Reason */}
          {request.reason && (
            <div className="bg-accent/50 rounded-[20px] p-4 sm:p-5">
              <h3 className="text-xs font-bold text-muted-foreground mr-1 mb-2">סיבה</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {request.reason}
              </p>
            </div>
          )}

          {/* Existing review (when not pending) */}
          {!isPending && (request.reviewer_name || request.review_note) && (
            <div className="bg-accent/50 rounded-[20px] p-4 sm:p-5 space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground mr-1">החלטת המאשר</h3>
              <div className="flex items-center gap-3 flex-wrap">
                {request.reviewer_name && (
                  <span className="text-sm font-bold text-foreground">
                    {request.reviewer_name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(request.reviewed_at)}
                </span>
              </div>
              {request.review_note && (
                <p className="text-sm text-foreground whitespace-pre-wrap bg-card border border-border/15 rounded-xl px-3 py-2">
                  {request.review_note}
                </p>
              )}
            </div>
          )}

          {/* Attachments */}
          <div className="bg-accent/50 rounded-[20px] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">קבצים מצורפים</h3>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {request.attachments_count ?? 0}
              </span>
            </div>

            {loadingAttachments ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Icon name="hourglass_empty" size="sm" className="animate-spin opacity-50" />
                טוען קבצים...
              </div>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין קבצים מצורפים</p>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {attachments.map((att) => (
                  <li key={att.id}>
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-card border border-border/15 rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all min-h-[44px]"
                    >
                      {isImage(att.mime) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={att.url}
                          alt={att.name}
                          className="w-full h-24 object-cover bg-accent"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-24 flex items-center justify-center bg-accent">
                          <Icon
                            name={att.mime?.includes("pdf") ? "picture_as_pdf" : "description"}
                            size="xl"
                            className="text-muted-foreground"
                          />
                        </div>
                      )}
                      <div className="p-2">
                        <p
                          className="text-xs font-medium text-foreground truncate"
                          title={att.name}
                        >
                          {att.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {formatBytes(att.size)}
                        </p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Manager note input (pending only) */}
          {isPending && (
            <div className="bg-accent/50 rounded-[20px] p-4 sm:p-5">
              <FormField label="הערת מאשר (אופציונלי)">
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value.slice(0, 500))}
                  className={textareaClass}
                  rows={3}
                  placeholder="הסבר על ההחלטה — יוצג לעובד"
                  disabled={!!submitting}
                />
                <p
                  className={`text-[11px] mr-1 mt-1 ${
                    charsLeft < 50 ? "text-amber-700" : "text-muted-foreground"
                  }`}
                >
                  נשארו <span className="tabular-nums">{charsLeft}</span> תווים
                </p>
              </FormField>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border/15 px-4 sm:px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-start gap-2 shrink-0 flex-wrap">
          {isPending ? (
            <>
              <button
                type="button"
                onClick={() => handleSubmit("approved")}
                disabled={!!submitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-sm hover:bg-emerald-700 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting === "approved" ? (
                  <Icon name="hourglass_empty" size="sm" className="text-white animate-spin" />
                ) : (
                  <Icon name="check_circle" size="sm" className="text-white" />
                )}
                {submitting === "approved" ? "מאשר..." : "אשר בקשה"}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit("rejected")}
                disabled={!!submitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white font-bold text-sm shadow-sm hover:bg-red-700 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting === "rejected" ? (
                  <Icon name="hourglass_empty" size="sm" className="text-white animate-spin" />
                ) : (
                  <Icon name="cancel" size="sm" className="text-white" />
                )}
                {submitting === "rejected" ? "דוחה..." : "דחה בקשה"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={!!submitting}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-border/40 text-muted-foreground font-bold text-sm hover:bg-accent transition-colors min-h-[44px] disabled:opacity-50"
              >
                ביטול
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-border/40 text-foreground font-bold text-sm hover:bg-accent transition-colors min-h-[44px]"
            >
              סגור
            </button>
          )}
        </div>
      </div>
    </SidePanel>
  )
}

/* ── Helpers ────────────────────────────────────────────────── */

function InfoCell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border/15 rounded-xl px-3 py-2">
      <p className="text-[11px] font-bold text-muted-foreground mb-1">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}
