"use client"

import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { Icon } from "@/components/shared/Icon"
import { SOURCE_LABELS } from "@/lib/constants/reservation"

const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]

function fmtDateHeb(d: string): string {
  if (!d) return "—"
  const dt = new Date(d)
  return `${dt.getDate()} ${HEB_MONTHS[dt.getMonth()]}, ${dt.getFullYear()}`
}

export function ReservationSummary() {
  const s = useReservationFormStore()
  const sym = s.currency === "USD" ? "$" : s.currency === "EUR" ? "€" : "₪"

  return (
    <div className="bg-card rounded-[20px] overflow-hidden shadow-sm border border-border/20">
      {/* Gradient header */}
      <div className="p-6 bg-gradient-to-br from-primary to-primary-container text-white">
        <h2 className="text-xl font-bold mb-1 font-headline">סיכום הזמנה</h2>
        <p className="text-xs opacity-80">צפייה בזמן אמת בפרטי השהייה</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Guest name */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest mb-1">שם האורח</div>
            <div className="text-sm font-bold">{s.fullName || s.firstName || "ישראל ישראלי"}</div>
          </div>
          <Icon name="person" size="md" className="text-muted-foreground/50" />
        </div>

        {/* Dates grid */}
        <div className="grid grid-cols-2 gap-4 bg-accent p-4 rounded-xl">
          <div>
            <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest mb-1">כניסה</div>
            <div className="text-sm font-bold">{fmtDateHeb(s.checkIn)}</div>
          </div>
          <div>
            <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest mb-1">יציאה</div>
            <div className="text-sm font-bold">{fmtDateHeb(s.checkOut)}</div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-4">
          {s.source && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">מקור</span>
              <span className="font-semibold">{SOURCE_LABELS[s.source] || s.source}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">מספר לילות</span>
            <span className="font-semibold">{s.nights > 0 ? `${s.nights} לילות` : "—"}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">אורחים</span>
            <span className="font-semibold">
              {s.adults} מבוגרים{s.children > 0 ? `, ${s.children} ילדים` : ""}{s.infants > 0 ? `, ${s.infants} תינוקות` : ""}
            </span>
          </div>
        </div>

        {/* Pricing */}
        {s.pricePerNight > 0 && (
          <div className="pt-6 border-t border-border/20 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">מחיר ללילה (ממוצע)</span>
              <span className="font-semibold">{sym}{s.pricePerNight.toLocaleString()}</span>
            </div>
            {s.discountTotal > 0 && (
              <div className="flex justify-between items-center text-sm text-emerald-600">
                <span>הנחה</span>
                <span className="font-semibold">-{sym}{s.discountTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            {s.extraCharges > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">חיובים נוספים</span>
                <span className="font-semibold">{sym}{s.extraCharges.toLocaleString()}</span>
              </div>
            )}
            {s.taxAmount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">מיסים</span>
                <span className="font-semibold">{sym}{s.taxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-primary pt-2">
              <span className="text-lg font-bold">סה״כ לתשלום</span>
              <div className="text-2xl font-black">{sym}{s.grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>

            {s.balanceDue > 0 && s.balanceDue !== s.grandTotal && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">יתרה</span>
                <span className="font-bold text-destructive">{sym}{s.balanceDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Room availability indicator */}
      {s.roomId && (
        <div className="mx-4 mb-4 bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200/30 flex items-center gap-3">
          <Icon name="bolt" filled size="sm" className="text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">החדר פנוי בתאריכים שנבחרו</p>
        </div>
      )}
    </div>
  )
}
