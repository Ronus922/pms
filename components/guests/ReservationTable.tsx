"use client"

import type { ReservationSearchRow } from "@/lib/actions/reservation-search"

/* ── Helpers ───────────────────────────────────────────────── */

function fmtDate(v: string | null): string {
  if (!v) return "—"
  const d = new Date(v)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function fmtPrice(v: number | null): string {
  if (v == null) return "—"
  return Number(v).toLocaleString("he-IL") + " ₪"
}

/* ── Status border color (right border) ────────────────────── */

function statusBorderColor(status: string): string {
  switch (status) {
    case "confirmed":
      return "border-r-emerald-500"
    case "checked_in":
      return "border-r-blue-500"
    case "checked_out":
      return "border-r-slate-400"
    case "pending":
      return "border-r-amber-500"
    case "cancelled":
      return "border-r-red-500"
    case "no_show":
      return "border-r-red-600"
    case "draft":
      return "border-r-slate-300"
    default:
      return "border-r-slate-300"
  }
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
      <div className="bg-card rounded-[20px] border border-border/20 shadow-sm py-16 text-center">
        <p className="text-lg font-medium text-muted-foreground">לא נמצאו הזמנות</p>
        <p className="text-sm text-muted-foreground mt-2">נסה לשנות את הפילטרים</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-[20px] border border-border/20 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr className="border-b border-border/20 bg-accent/50">
              <th className="px-4 py-3 text-right font-bold text-muted-foreground text-xs">שם הלקוח</th>
              <th className="px-4 py-3 text-right font-bold text-muted-foreground text-xs">משפחה</th>
              <th className="px-4 py-3 text-center font-bold text-muted-foreground text-xs">הגעה</th>
              <th className="px-4 py-3 text-center font-bold text-muted-foreground text-xs">עזיבה</th>
              <th className="px-4 py-3 text-center font-bold text-muted-foreground text-xs">לילות</th>
              <th className="px-4 py-3 text-center font-bold text-muted-foreground text-xs">נפשות</th>
              <th className="px-4 py-3 text-left font-bold text-muted-foreground text-xs">מחיר</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row)}
                className={`
                  border-b border-border/10 cursor-pointer transition-colors
                  hover:bg-accent/60
                  border-r-4 ${statusBorderColor(row.status)}
                  ${selectedId === row.id ? "bg-primary/5" : ""}
                `}
              >
                <td className="px-4 py-3 font-bold">{row.first_name}</td>
                <td className="px-4 py-3">{row.last_name}</td>
                <td className="px-4 py-3 text-center tabular-nums">{fmtDate(row.check_in)}</td>
                <td className="px-4 py-3 text-center tabular-nums">{fmtDate(row.check_out)}</td>
                <td className="px-4 py-3 text-center font-bold tabular-nums">{row.nights}</td>
                <td className="px-4 py-3 text-center tabular-nums">{row.total_guests}</td>
                <td className="px-4 py-3 text-left font-bold text-primary tabular-nums">{fmtPrice(row.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
