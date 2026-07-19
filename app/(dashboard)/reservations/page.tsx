"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { getReservationsList } from "@/lib/actions/guests"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { useTenant } from "@/lib/hooks/use-tenant"
import { STATUS_LABELS, PAYMENT_LABELS, STATUS_BORDER_COLORS } from "@/lib/constants/reservation"

interface Reservation {
  id: string
  reservation_number: string
  status: string
  check_in: string | Date
  check_out: string | Date
  adults: number
  children: number
  source: string
  is_vip: boolean
  payment_status: string
  total_price: number
  balance_due: number
  guest_name: string
  guest_phone: string
  room_numbers: string
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  checked_in: "bg-emerald-50 text-emerald-700",
  checked_out: "bg-accent text-muted-foreground",
  cancelled: "bg-red-50/80 text-red-600",
  no_show: "bg-orange-50 text-orange-600",
  pending: "bg-amber-50 text-amber-700",
  draft: "bg-accent text-muted-foreground",
}
const PAYMENT_COLORS: Record<string, string> = {
  unpaid: "text-red-500", partially_paid: "text-amber-600", fully_paid: "text-emerald-600",
}

function fmtDate(v: string | Date): string {
  if (!v) return "—"
  const d = typeof v === "string" ? new Date(v) : v
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

function calcNights(ci: string | Date, co: string | Date): number {
  const a = typeof ci === "string" ? new Date(ci) : ci
  const b = typeof co === "string" ? new Date(co) : co
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

export default function ReservationsPage() {
  const { tenantId } = useTenant()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const openNew = useReservationFormStore((s) => s.open)
  const openEdit = useReservationEditStore((s) => s.open)
  /* Subscribe to the edit store's save tick — every successful edit bumps
   * it and this page re-fetches so payment status / color / dates update
   * without a manual reload. Shared-store pattern because the edit panel
   * itself lives at the shell level (single instance across the app). */
  const savedTick = useReservationEditStore((s) => s.savedTick)

  const loadData = useCallback((initial = false) => {
    // Only flip the skeleton on the first mount — subsequent refreshes
    // (after an edit-panel save) must keep the rendered rows visible so
    // the saved reservation doesn't briefly "disappear" during refetch.
    if (initial) setLoading(true)
    getReservationsList(tenantId).then((data) => {
      setReservations(data as unknown as Reservation[])
      setLoading(false)
    })
  }, [tenantId])

  useEffect(() => { loadData(true) }, [loadData])
  useEffect(() => {
    if (savedTick === 0) return
    loadData(false)
  }, [savedTick, loadData])

  const filtered = reservations.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.reservation_number?.toLowerCase().includes(q) || r.guest_name?.toLowerCase().includes(q) || r.room_numbers?.includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold font-headline">הזמנות</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} הזמנות</p>
        </div>
        <button
          onClick={() => openNew()}
          className="btn btn-primary"
        >
          <Icon name="add" size="sm" /> הזמנה חדשה
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[300px]">
          <Icon name="search" size="sm" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-accent border border-border/40 rounded-xl pr-11 pl-5 py-3.5 min-h-[48px] text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all"
            placeholder="חיפוש לפי מספר הזמנה, שם אורח או חדר..."
          />
        </div>
        <div className="flex bg-card rounded-xl border border-border/20 p-1 gap-1 overflow-x-auto no-scrollbar">
          {([["all", "הכל"], ["confirmed", "מאושר"], ["checked_in", "In House"], ["checked_out", "יצא"], ["cancelled", "בוטל"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-colors whitespace-nowrap min-h-[44px] ${
                statusFilter === key
                  ? "bg-gradient-to-l from-primary to-secondary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden" dir="rtl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="bg-primary/10">
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap w-[180px]">מס׳ הזמנה</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap">אורח</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap">טלפון</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap">חדר</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap">כניסה</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap">יציאה</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap">לילות</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap">סטטוס</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap">תשלום</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 whitespace-nowrap">סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/10">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-accent rounded w-3/4 animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Icon name="book_online" size="xl" className="opacity-20" />
                      <p className="text-lg font-bold">לא נמצאו הזמנות</p>
                      <p className="text-sm">נסה לשנות את החיפוש או הסינון</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((r, idx) => {
                const isEven = idx % 2 === 1
                return (
                <tr
                  key={r.id}
                  onDoubleClick={() => openEdit(r.id, tenantId)}
                  style={{ borderRightWidth: "4px", borderRightStyle: "solid", borderRightColor: STATUS_BORDER_COLORS[r.status] || "#9ca3af" }}
                  className={`border-b border-border/10 hover:bg-primary/5 cursor-pointer transition-colors ${isEven ? "bg-accent/40" : ""}`}
                >
                  {/* Reservation number */}
                  <td className="px-5 py-4 font-bold text-primary tabular-nums whitespace-nowrap">
                    {r.reservation_number}
                  </td>

                  {/* Guest */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">{r.guest_name?.charAt(0) || "?"}</span>
                      </div>
                      <span className="font-bold text-foreground text-base whitespace-nowrap">{r.guest_name}</span>
                      {r.is_vip && <Icon name="star" size="sm" className="text-amber-500 shrink-0" />}
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-5 py-4 text-foreground tabular-nums whitespace-nowrap" dir="ltr">
                    <span className="float-right">{r.guest_phone || "—"}</span>
                  </td>

                  {/* Room */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent text-foreground text-xs font-bold">
                      {r.room_numbers || "—"}
                    </span>
                  </td>

                  {/* Check-in */}
                  <td className="px-5 py-4 text-foreground tabular-nums whitespace-nowrap">{fmtDate(r.check_in)}</td>

                  {/* Check-out */}
                  <td className="px-5 py-4 text-foreground tabular-nums whitespace-nowrap">{fmtDate(r.check_out)}</td>

                  {/* Nights */}
                  <td className="px-5 py-4 font-bold text-foreground tabular-nums whitespace-nowrap">
                    {calcNights(r.check_in, r.check_out)}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${STATUS_COLORS[r.status] || "bg-accent text-muted-foreground"}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>

                  {/* Payment */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={`text-xs font-bold ${PAYMENT_COLORS[r.payment_status] || "text-muted-foreground"}`}>
                      {PAYMENT_LABELS[r.payment_status] || r.payment_status}
                    </span>
                  </td>

                  {/* Total */}
                  <td className="px-5 py-4 font-bold text-primary tabular-nums whitespace-nowrap">
                    {Number(r.total_price).toLocaleString("he-IL")} ₪
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit panel is rendered once at the shell level — this page
          re-fetches via the `savedTick` subscription above whenever a save
          lands, so no duplicate panel instance is mounted here. */}
    </div>
  )
}
