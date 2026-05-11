"use client"

import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass } from "@/components/shared/FormField"
import { StatusPill } from "@/components/reservations/StatusPill"
import { SmartField } from "@/components/reservations/FieldLock"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { PAYMENT_METHODS } from "@/lib/constants/payments"

/* ── Helpers ───────────────────────────────────────────────── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  )
}

function SummaryRow({ label, value, color, bold, large }: {
  label: string; value: string; color?: string; bold?: boolean; large?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${bold ? "font-bold" : ""} text-muted-foreground`}>{label}</span>
      <span className={`tabular-nums ${large ? "text-lg font-bold" : "text-sm"} ${bold ? "font-bold" : ""} ${color || "text-foreground"}`}>
        {value}
      </span>
    </div>
  )
}

function fmt(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ── Component ─────────────────────────────────────────────── */

export function EditStep3Pricing() {
  const store = useReservationEditStore()
  const { data, isExternal, editableRooms, nights, payments, cardRevealed } = store

  // Compute totals from the LIVE per-room draft. Base amount must be the
  // SUM of (rate × per-room nights) — multiplying a single outer-span
  // `nights` by the sum of rates overcharges short-stay rooms in a
  // multi-room reservation (e.g. room A: 2 nights, room B: 4 nights).
  const totalNightlyRate = editableRooms.length > 0
    ? editableRooms.reduce((sum, r) => sum + (Number(r.ratePerNight) || 0), 0)
    : data.totalPrice / Math.max(nights, 1)

  const baseAmount = editableRooms.length > 0
    ? editableRooms.reduce((sum, r) => {
        const rci = r.checkIn ? new Date(r.checkIn) : null
        const rco = r.checkOut ? new Date(r.checkOut) : null
        const rNights = rci && rco
          ? Math.max(0, Math.round((rco.getTime() - rci.getTime()) / 86400000))
          : 0
        return sum + (Number(r.ratePerNight) || 0) * rNights
      }, 0)
    : totalNightlyRate * nights

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. Pricing ──────────────────────────────────────── */}
      <SectionCard title="תמחור">
        <SmartField isExternal={isExternal} lockType={isExternal ? "warning" : "editable"}>
          {editableRooms.length > 0 ? (
            <div className="flex flex-col gap-3">
              {editableRooms.map((room) => {
                const rci = room.checkIn ? new Date(room.checkIn) : null
                const rco = room.checkOut ? new Date(room.checkOut) : null
                const rNights = rci && rco
                  ? Math.max(0, Math.round((rco.getTime() - rci.getTime()) / 86400000))
                  : 0
                const subtotal = (Number(room.ratePerNight) || 0) * rNights
                return (
                  <div key={room.id} className="flex items-center justify-between bg-accent/50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon name="bed" size="sm" className="text-primary shrink-0" />
                      <span className="text-sm font-bold text-foreground truncate">חדר {room.roomNumber || "—"}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-sm font-bold tabular-nums text-foreground">{fmt(subtotal)}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {fmt(Number(room.ratePerNight))} × {rNights} לילות
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <FormField label="מחיר כולל" required>
                <div className="relative">
                  <input type="number" value={data.totalPrice || ""} onChange={(e) => store.setField("totalPrice", Number(e.target.value) || 0)} placeholder="0" min={0} dir="ltr" className={`${inputClass} pe-12 text-start tabular-nums`} />
                  <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">₪</div>
                </div>
              </FormField>
              <FormField label="מספר לילות">
                <div className={`${inputClass} bg-muted/50 tabular-nums flex items-center`}>{nights}</div>
              </FormField>
            </div>
          )}
        </SmartField>

        {/* Base amount display */}
        <div className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <FormField label="סכום בסיסי">
            <div className={`${inputClass} bg-muted/50 tabular-nums flex items-center`}>{fmt(baseAmount)}</div>
          </FormField>
          <FormField label="הנחה (%)">
            <div className="relative">
              <input type="number" value={data.discountPercent || ""} onChange={(e) => store.setField("discountPercent", Math.min(100, Math.max(0, Number(e.target.value) || 0)))} placeholder="0" min={0} max={100} dir="ltr" className={`${inputClass} pe-12 text-start tabular-nums`} />
              <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">%</div>
            </div>
          </FormField>
        </div>

        {/* Tax Exempt Toggle */}
        <div className="mt-4 bg-accent/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name="public" size="md" className="text-muted-foreground" />
              <div>
                <span className="text-sm font-bold text-foreground">פטור ממע״מ</span>
                <p className="text-xs text-muted-foreground mt-0.5">תושב חוץ</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => store.setField("taxExempt", !data.taxExempt)}
              className={`w-12 h-7 rounded-full transition-colors relative ${data.taxExempt ? "bg-primary" : "bg-border/40"}`}
              aria-label="פטור ממע״מ"
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${data.taxExempt ? "left-0.5" : "left-[calc(100%-1.625rem)]"}`} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">
            מע״מ ({(() => {
              if (data.taxExempt) return "פטור"
              // Derive effective rate from the stored taxAmount / afterDiscount
              // so the label matches what was actually charged on this reservation.
              const base = data.subtotal || 0
              if (base <= 0 || !data.taxAmount) return "—"
              const pct = (data.taxAmount / base) * 100
              return `${pct.toFixed(pct % 1 === 0 ? 0 : 2)}%`
            })()})
          </span>
          <span className="text-sm font-bold tabular-nums text-foreground">{fmt(data.taxAmount)}</span>
        </div>
      </SectionCard>

      {/* ── 2. Payment Summary ──────────────────────────────── */}
      <SectionCard title="סיכום תשלום">
        <div className="flex flex-col gap-1">
          <SummaryRow label="סכום בסיסי" value={fmt(baseAmount)} />
          {data.discountPercent > 0 && (
            <SummaryRow label="הנחה" value={`-${fmt(baseAmount * data.discountPercent / 100)}`} color="text-emerald-600 dark:text-emerald-400" />
          )}
          <SummaryRow label="מע״מ" value={`+${fmt(data.taxAmount)}`} />
          <div className="border-t border-border/30 my-2" />
          <SummaryRow label="סה״כ לתשלום" value={fmt(data.totalPrice)} large bold color="text-[#003aa0] dark:text-blue-400" />
          <SummaryRow label="שולם" value={fmt(data.totalPaid)} />
          <SummaryRow label="מקדמה" value={fmt(data.deposit)} />
          <SummaryRow label="יתרה לתשלום" value={fmt(data.balanceDue)} bold color={data.balanceDue > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"} />
        </div>
      </SectionCard>

      {/* ── 3. Payment Method ───────────────────────────────── */}
      <SectionCard title="אמצעי תשלום">
        <div className="flex flex-col gap-4">
          <FormField label="אמצעי תשלום">
            <select value={data.paymentMethod} onChange={(e) => store.setField("paymentMethod", e.target.value)} className={selectClass}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <FormField label="מקדמה">
              <div className="relative">
                <input type="number" value={data.deposit || ""} onChange={(e) => store.setField("deposit", Number(e.target.value) || 0)} placeholder="0" min={0} dir="ltr" className={`${inputClass} pe-12 text-start tabular-nums`} />
                <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">₪</div>
              </div>
            </FormField>
            <FormField label="סכום ששולם">
              <div className="relative">
                <input type="number" value={data.totalPaid || ""} onChange={(e) => store.setField("totalPaid", Number(e.target.value) || 0)} placeholder="0" min={0} dir="ltr" className={`${inputClass} pe-12 text-start tabular-nums`} />
                <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">₪</div>
              </div>
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* ── 4. Credit Card — masked by default ──────────────── */}
      {data.paymentMethod === "credit_card" && (
        <SectionCard title="פרטי כרטיס אשראי">
          <div className="flex items-center justify-between bg-accent/50 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-3">
              <Icon name="credit_card" size="md" className="text-muted-foreground" />
              <span className="text-sm font-bold tabular-nums" dir="ltr">
                {cardRevealed ? "4580 **** **** ****" : "**** **** **** ****"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => store.toggleCardReveal()}
              className="w-9 h-9 rounded-xl bg-accent hover:bg-border/40 flex items-center justify-center transition-colors min-w-[44px] min-h-[44px]"
              aria-label={cardRevealed ? "הסתר פרטי כרטיס" : "הצג פרטי כרטיס"}
              title={cardRevealed ? "הסתר פרטי כרטיס" : "הצג פרטי כרטיס"}
            >
              <Icon name={cardRevealed ? "visibility_off" : "visibility"} size="sm" className="text-muted-foreground" />
            </button>
          </div>

          {/* Charge actions */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
            >
              <Icon name="credit_card" size="md" className="text-white" />
              חייב עכשיו
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── 5. Payment History ──────────────────────────────── */}
      {payments.length > 0 && (
        <SectionCard title={`היסטוריית תשלומים (${payments.length})`}>
          <div className="flex flex-col gap-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-accent/30 rounded-xl px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("he-IL")} • {p.method}
                  </span>
                  {p.status && <StatusPill type="paymentResult" value={p.status} size="sm" />}
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground">{fmt(Number(p.amount))}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
