"use client"

import { Icon } from "@/components/shared/Icon"
import { StatusPill } from "@/components/reservations/StatusPill"
import { SourceBadge } from "@/components/reservations/SourceBadge"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/payments"
import { LANGUAGE_LABELS, COUNTRY_LABELS } from "@/lib/constants/localization"

/* ── Helpers — same visual as Step4Review ──────────────────── */

function SectionCard({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
        {icon && <Icon name={icon} size="md" className="text-primary" />}
        {title}
      </h3>
      {children}
    </div>
  )
}

function ReviewRow({ label, value, dir }: { label: string; value: React.ReactNode; dir?: string }) {
  if (!value || value === "") return null
  return (
    <div className="flex items-start justify-between py-1.5 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-bold text-foreground text-start" dir={dir}>{value}</span>
    </div>
  )
}

function SummaryAmountRow({ label, value, color, bold, large }: {
  label: string; value: string; color?: string; bold?: boolean; large?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${bold ? "font-bold" : ""} text-muted-foreground`}>{label}</span>
      <span className={`tabular-nums ${large ? "text-lg font-bold" : "text-sm"} ${bold ? "font-bold" : ""} ${color || "text-foreground"}`}>{value}</span>
    </div>
  )
}

function fmt(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(v: string): string {
  if (!v) return "—"
  const d = new Date(v)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function fmtDateTime(v: string): string {
  if (!v) return "—"
  const d = new Date(v)
  return `${fmtDate(v)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/* ── Component ─────────────────────────────────────────────── */

export function EditStep4Summary() {
  const store = useReservationEditStore()
  const { data, editableRooms, nights, payments, logs, isExternal, reservationNumber, createdAt, updatedAt } = store

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. Guest Summary ─────────────────────────────────── */}
      <SectionCard title="פרטי אורח" icon="person">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-base font-bold text-foreground">
              {data.guestName || `${data.firstName} ${data.lastName}`.trim() || "---"}
            </span>
            {data.isVip && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[12px] font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Icon name="crown" size="sm" />VIP
              </span>
            )}
          </div>
          <ReviewRow label="טלפון" value={data.phone} dir="ltr" />
          <ReviewRow label="אימייל" value={data.email} dir="ltr" />
          <ReviewRow label="ת.ז / דרכון" value={data.idNumber} dir="ltr" />
          <ReviewRow label="מדינה" value={COUNTRY_LABELS[data.country] || data.country} />
          <ReviewRow label="שפה" value={LANGUAGE_LABELS[data.language] || data.language} />
          <ReviewRow label="חברה" value={data.company} />
          {data.source && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">מקור</span>
              <SourceBadge value={data.source} />
            </div>
          )}
          {data.agent && <ReviewRow label="סוכן" value={data.agent} />}
        </div>
      </SectionCard>

      {/* ── 2. Stay Summary ──────────────────────────────────── */}
      <SectionCard title="פרטי שהייה" icon="calendar_today">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between py-2 mb-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="login" size="sm" className="text-emerald-500" /><span>כניסה</span>
            </div>
            <span className="text-sm font-bold tabular-nums" dir="ltr">
              {fmtDate(data.checkIn)}{data.checkInTime ? ` ${data.checkInTime}` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 mb-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="logout" size="sm" className="text-red-500" /><span>יציאה</span>
            </div>
            <span className="text-sm font-bold tabular-nums" dir="ltr">
              {fmtDate(data.checkOut)}{data.checkOutTime ? ` ${data.checkOutTime}` : ""}
            </span>
          </div>
          <div className="bg-primary/5 rounded-lg px-3 py-2 text-center mb-2">
            <span className="text-sm font-bold text-primary tabular-nums">{nights} לילות</span>
          </div>
          <div className="border-t border-border/20 mt-2 pt-2">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <Icon name="person" size="sm" className="text-muted-foreground" />
                <span className="text-sm tabular-nums">{data.adults} מבוגרים</span>
              </div>
              {data.children > 0 && (
                <div className="flex items-center gap-1.5">
                  <Icon name="group" size="sm" className="text-muted-foreground" />
                  <span className="text-sm tabular-nums">{data.children} ילדים</span>
                </div>
              )}
              {data.infants > 0 && (
                <div className="flex items-center gap-1.5">
                  <Icon name="child_care" size="sm" className="text-muted-foreground" />
                  <span className="text-sm tabular-nums">{data.infants} תינוקות</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── 3. Rooms Summary — sourced from the live editable draft, not
             the static snapshot, so unsaved per-room changes show up here. */}
      <SectionCard title="חדרים" icon="bed">
        {editableRooms.length > 0 ? (
          <div className="flex flex-col gap-3">
            {editableRooms.map((room, idx) => {
              const guestName = `${room.guestFirstName || ""} ${room.guestLastName || ""}`.trim()
              return (
                <div key={room.id} className="bg-accent/50 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-bold text-foreground truncate">
                        חדר {idx + 1}: {room.roomTypeName || "—"}
                        {room.roomNumber ? ` · מס׳ ${room.roomNumber}` : ""}
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-primary shrink-0">
                      {fmt(Number(room.ratePerNight))} / לילה
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <span dir="ltr" className="tabular-nums">
                      {fmtDate(room.checkIn)} → {fmtDate(room.checkOut)}
                    </span>
                    <span>
                      {room.adults} מבוגרים
                      {room.children > 0 ? ` · ${room.children} ילדים` : ""}
                      {room.infants > 0 ? ` · ${room.infants} תינוקות` : ""}
                    </span>
                    {guestName && (
                      <span className="col-span-2">אורח: {guestName}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">לא שויכו חדרים</p>
        )}
      </SectionCard>

      {/* ── 4. Pricing Summary ───────────────────────────────── */}
      <SectionCard title="סיכום תמחור" icon="payments">
        <div className="flex flex-col gap-1">
          <SummaryAmountRow label="סה״כ לתשלום" value={fmt(data.totalPrice)} large bold color="text-primary dark:text-blue-400" />
          <SummaryAmountRow label="שולם" value={fmt(data.totalPaid)} />
          <SummaryAmountRow label="מקדמה" value={fmt(data.deposit)} />
          <div className="border-t border-border/30 my-2" />
          <SummaryAmountRow label="יתרה לתשלום" value={fmt(data.balanceDue)} bold color={data.balanceDue > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"} />
        </div>
      </SectionCard>

      {/* ── 5. Payment Info ──────────────────────────────────── */}
      <SectionCard title="פרטי תשלום" icon="credit_card">
        <div className="flex flex-col gap-1">
          <ReviewRow label="אמצעי תשלום" value={PAYMENT_METHOD_LABELS[data.paymentMethod] || data.paymentMethod || "---"} />
          {data.paymentStatus && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">סטטוס תשלום</span>
              <StatusPill type="payment" value={data.paymentStatus} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 6. Notes ─────────────────────────────────────────── */}
      {(data.generalNotes || data.internalNotes || data.receptionNotes) && (
        <SectionCard title="הערות" icon="sticky_note_2">
          <div className="flex flex-col gap-3">
            {data.generalNotes && (
              <div>
                <span className="text-xs font-bold text-muted-foreground mb-1 block">הערות כלליות</span>
                <p className="text-sm text-foreground bg-accent/50 rounded-xl px-4 py-3 whitespace-pre-wrap">{data.generalNotes}</p>
              </div>
            )}
            {data.internalNotes && (
              <div>
                <span className="text-xs font-bold text-muted-foreground mb-1 block">הערות פנימיות</span>
                <p className="text-sm text-foreground bg-amber-50 dark:bg-amber-950/20 rounded-xl px-4 py-3 whitespace-pre-wrap">{data.internalNotes}</p>
              </div>
            )}
            {data.receptionNotes && (
              <div>
                <span className="text-xs font-bold text-muted-foreground mb-1 block">הערות קבלה</span>
                <p className="text-sm text-foreground bg-accent/50 rounded-xl px-4 py-3 whitespace-pre-wrap">{data.receptionNotes}</p>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── 7. Audit Info ────────────────────────────────────── */}
      <SectionCard title="מידע מערכתי" icon="info">
        <div className="flex flex-col gap-1">
          <ReviewRow label="מספר הזמנה" value={reservationNumber} dir="ltr" />
          <ReviewRow label="נוצר בתאריך" value={fmtDateTime(createdAt)} dir="ltr" />
          <ReviewRow label="עודכן לאחרונה" value={fmtDateTime(updatedAt)} dir="ltr" />
          <ReviewRow label="מקור" value={data.source} />
          {data.externalId && <ReviewRow label="מזהה חיצוני" value={data.externalId} dir="ltr" />}
          {data.channelManagerId && <ReviewRow label="מנהל ערוצים" value={data.channelManagerId} dir="ltr" />}
          {isExternal && (
            <div className="mt-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon name="link" size="sm" className="text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-bold text-amber-800 dark:text-amber-300">הזמנה חיצונית</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                הזמנה זו הגיעה ממקור חיצוני. חלק מהשדות עלולים להיות נעולים לעריכה.
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 8. Communication Actions ─────────────────────────── */}
      <SectionCard title="תקשורת" icon="forum">
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-outline">
            <Icon name="email" size="sm" />אימייל
          </button>
          <button type="button" className="btn btn-outline">
            <Icon name="phone" size="sm" />SMS
          </button>
          <button type="button" className="btn btn-outline">
            <Icon name="whatsapp" size="sm" />WhatsApp
          </button>
        </div>
      </SectionCard>

      {/* ── 9. Audit Log ─────────────────────────────────────── */}
      {logs.length > 0 && (
        <SectionCard title={`היסטוריית שינויים (${logs.length})`} icon="history">
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 pb-4 border-b border-border/20 last:border-0">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                  <Icon name="history" size="sm" className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm"><span className="font-bold">{log.user_name || "מערכת"}</span> — {log.action}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(log.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── 10. Payment History ───────────────────────────────── */}
      {payments.length > 0 && (
        <SectionCard title={`היסטוריית תשלומים (${payments.length})`} icon="receipt_long">
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm bg-accent/30 rounded-xl px-4 py-3">
                <span className="text-muted-foreground">{fmtDateTime(p.created_at)} • {p.method}</span>
                <span className="font-bold tabular-nums">{fmt(Number(p.amount))}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
