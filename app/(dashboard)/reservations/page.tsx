"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { getReservationsList } from "@/lib/actions/guests"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { useReservationEditStore } from "@/lib/stores/reservation-edit-store"
import { useTenant } from "@/lib/hooks/use-tenant"
import { ExistingReservationPanel } from "@/components/reservations/ExistingReservationPanel"
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
  confirmed: "bg-[#003aa0]/10 text-[#003aa0]",
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

  const loadData = useCallback(() => {
    setLoading(true)
    getReservationsList(tenantId).then((data) => {
      setReservations(data as unknown as Reservation[])
      setLoading(false)
    })
  }, [tenantId])

  useEffect(() => { loadData() }, [loadData])

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
          className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2 min-h-[44px]"
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
                  ? "bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-border/20" style={{ backgroundColor: "#f8fafc" }}>
                <th className="text-right text-sm font-bold text-foreground/80 px-5 py-3.5">מס׳ הזמנה</th>
                <th className="text-right text-sm font-bold text-foreground/80 px-4 py-3.5">אורח</th>
                <th className="text-right text-sm font-bold text-foreground/80 px-4 py-3.5">טלפון</th>
                <th className="text-right text-sm font-bold text-foreground/80 px-4 py-3.5">חדר</th>
                <th className="text-center text-sm font-bold text-foreground/80 px-4 py-3.5">כניסה</th>
                <th className="text-center text-sm font-bold text-foreground/80 px-4 py-3.5">יציאה</th>
                <th className="text-center text-sm font-bold text-foreground/80 px-3 py-3.5">לילות</th>
                <th className="text-center text-sm font-bold text-foreground/80 px-4 py-3.5">סטטוס</th>
                <th className="text-center text-sm font-bold text-foreground/80 px-4 py-3.5">תשלום</th>
                <th className="text-right text-sm font-bold text-foreground/80 px-5 py-3.5">סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/10">
                    <td className="px-5 py-5"><div className="h-4 w-20 bg-accent rounded-lg animate-pulse" /></td>
                    <td className="px-4 py-5"><div className="h-4 w-24 bg-accent rounded-lg animate-pulse" /></td>
                    <td className="px-4 py-5"><div className="h-4 w-20 bg-accent rounded-lg animate-pulse" /></td>
                    <td className="px-4 py-5"><div className="h-4 w-10 bg-accent rounded-lg animate-pulse" /></td>
                    <td className="px-4 py-5"><div className="h-4 w-12 bg-accent rounded-lg animate-pulse mx-auto" /></td>
                    <td className="px-4 py-5"><div className="h-4 w-12 bg-accent rounded-lg animate-pulse mx-auto" /></td>
                    <td className="px-3 py-5"><div className="h-4 w-6 bg-accent rounded-lg animate-pulse mx-auto" /></td>
                    <td className="px-4 py-5"><div className="h-5 w-14 bg-accent rounded-full animate-pulse mx-auto" /></td>
                    <td className="px-4 py-5"><div className="h-4 w-14 bg-accent rounded-lg animate-pulse mx-auto" /></td>
                    <td className="px-5 py-5"><div className="h-4 w-16 bg-accent rounded-lg animate-pulse" /></td>
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
              ) : filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/15 hover:bg-accent/40 transition-colors cursor-pointer border-r-4 group"
                  style={{ borderRightColor: STATUS_BORDER_COLORS[r.status] || "#9ca3af", minHeight: 52 }}
                  onDoubleClick={() => openEdit(r.id, tenantId)}
                >
                  <td className="px-5 py-4">
                    <span className="text-sm font-bold text-primary">{r.reservation_number}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                        {r.guest_name?.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{r.guest_name}</span>
                      {r.is_vip && <Icon name="star" size="sm" className="text-amber-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-muted-foreground tabular-nums" dir="ltr">{r.guest_phone || "—"}</td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold bg-accent px-2 py-0.5 rounded-lg">{r.room_numbers || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-center text-sm tabular-nums">{fmtDate(r.check_in)}</td>
                  <td className="px-4 py-4 text-center text-sm tabular-nums">{fmtDate(r.check_out)}</td>
                  <td className="px-3 py-4 text-center">
                    <span className="text-sm font-bold bg-accent/80 px-2 py-0.5 rounded-lg">{calcNights(r.check_in, r.check_out)}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${STATUS_COLORS[r.status] || "bg-accent text-muted-foreground"}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-xs font-bold ${PAYMENT_COLORS[r.payment_status] || ""}`}>
                      {PAYMENT_LABELS[r.payment_status] || r.payment_status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm font-bold tabular-nums">{Number(r.total_price).toLocaleString()} ₪</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Existing Reservation Edit Panel */}
      <ExistingReservationPanel onSaved={loadData} />
    </div>
  )
}
