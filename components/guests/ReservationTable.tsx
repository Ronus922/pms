"use client"

import { Icon } from "@/components/shared/Icon"
import { STATUS_BORDER_COLORS } from "@/lib/constants/reservation"
import type { ReservationSearchRow } from "@/lib/actions/reservation-search"

/* ── Helpers ───────────────────────────────────────────────── */

function fmtDate(v: string | null): string {
  if (!v) return "—"
  const d = new Date(v)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = String(d.getFullYear()).slice(-2)
  return `${day}/${month}/${year}`
}

function fmtPrice(v: number | null): string {
  if (v == null) return "—"
  return Number(v).toLocaleString("he-IL") + " ₪"
}

function getInitials(first: string, last: string): string {
  const a = (first || "").trim().charAt(0)
  const b = (last || "").trim().charAt(0)
  return (a + b) || "?"
}

/* ── Component ─────────────────────────────────────────────── */

interface Props {
  rows: ReservationSearchRow[]
  onRowClick: (row: ReservationSearchRow) => void
  selectedId: string | null
}

export function ReservationTable({ rows, onRowClick, selectedId }: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden" dir="rtl">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="event_busy" size="xl" className="opacity-30" />
          <p className="text-lg font-medium">לא נמצאו הזמנות</p>
          <p className="text-sm">נסו לשנות את מסנני החיפוש</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden" dir="rtl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#e1e7fa]">
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap w-[180px]">מס׳ הזמנה</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">שם אורח</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 max-md:hidden">טלפון</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">הגעה</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">עזיבה</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">לילות</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 max-lg:hidden">נפשות</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">מחיר</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isEven = idx % 2 === 1
              const isSelected = selectedId === row.id
              const borderColor = STATUS_BORDER_COLORS[row.status] ?? "#9ca3af"

              return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick(row)}
                  style={{ borderRightWidth: "4px", borderRightStyle: "solid", borderRightColor: borderColor }}
                  className={`border-b border-border/10 hover:bg-primary/5 cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/5" : isEven ? "bg-accent/40" : ""
                  }`}
                >
                  {/* Reservation number */}
                  <td className="px-5 py-4 font-bold text-primary tabular-nums whitespace-nowrap">
                    {row.reservation_number}
                  </td>

                  {/* Guest name + avatar */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {getInitials(row.first_name, row.last_name)}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-foreground text-base truncate">
                          {row.first_name} {row.last_name}
                        </span>
                        {row.guest_email && (
                          <span className="text-[11px] text-muted-foreground truncate" dir="ltr">
                            {row.guest_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-5 py-4 text-foreground tabular-nums max-md:hidden" dir="ltr">
                    <span className="float-right">{row.guest_phone || "—"}</span>
                  </td>

                  {/* Check-in */}
                  <td className="px-5 py-4 text-foreground tabular-nums">{fmtDate(row.check_in)}</td>

                  {/* Check-out */}
                  <td className="px-5 py-4 text-foreground tabular-nums">{fmtDate(row.check_out)}</td>

                  {/* Nights */}
                  <td className="px-5 py-4 font-bold text-foreground tabular-nums">{row.nights}</td>

                  {/* Guests */}
                  <td className="px-5 py-4 text-foreground tabular-nums max-lg:hidden">{row.total_guests}</td>

                  {/* Price */}
                  <td className="px-5 py-4 font-bold text-primary tabular-nums">{fmtPrice(row.total_price)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
