"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { getReservationFull } from "@/lib/actions/reservation-detail"
import { updateReservationStatus, toggleVip, cancelReservation } from "@/lib/actions/reservations"
import { STATUS_LABELS, PAYMENT_LABELS, SOURCE_LABELS } from "@/lib/constants/reservation"

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  checked_in: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30",
  checked_out: "bg-accent text-muted-foreground",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-950/30",
  no_show: "bg-red-50 text-red-700",
  draft: "bg-accent text-muted-foreground",
  pending: "bg-amber-50 text-amber-700",
}

const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]

function fmtDate(v: string | Date): string {
  if (!v) return "—"
  const d = typeof v === "string" ? new Date(v) : v
  return `${d.getDate()} ${HEB_MONTHS[d.getMonth()]}, ${d.getFullYear()}`
}

function fmtDateTime(v: string | Date): string {
  if (!v) return "—"
  const d = typeof v === "string" ? new Date(v) : v
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

function nights(ci: string | Date, co: string | Date): number {
  const a = typeof ci === "string" ? new Date(ci) : ci
  const b = typeof co === "string" ? new Date(co) : co
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

type Tab = "details" | "rooms" | "notes" | "logs"

interface Props {
  reservationId: string
  tenantId: string
  onUpdate?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReservationDetailView({ reservationId, tenantId, onUpdate }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("details")
  const [actionLoading, setActionLoading] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getReservationFull(reservationId)
    setData(result)
    setLoading(false)
  }, [reservationId])

  useEffect(() => { load() }, [load])

  async function handleAction(action: string) {
    if (!data) return
    setActionLoading(action)
    if (action === "check_in") await updateReservationStatus(data.id, tenantId, "checked_in")
    else if (action === "check_out") await updateReservationStatus(data.id, tenantId, "checked_out")
    else if (action === "vip") await toggleVip(data.id, tenantId)
    else if (action === "cancel") await cancelReservation(data.id, tenantId)
    setActionLoading("")
    await load()
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Icon name="hourglass_empty" size="xl" className="text-muted-foreground opacity-30" />
      </div>
    )
  }

  const n = nights(data.check_in, data.check_out)

  const TABS: { key: Tab; label: string }[] = [
    { key: "details", label: "פרטים" },
    { key: "rooms", label: "חדרים" },
    { key: "notes", label: "הערות" },
    { key: "logs", label: "Logs" },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-extrabold font-headline">הזמנה {data.reservation_number}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[data.status] || "bg-accent text-muted-foreground"}`}>
              {STATUS_LABELS[data.status] || data.status}
            </span>
            {(data.is_vip || data.guest_vip) && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 flex items-center gap-1">
                <Icon name="star" filled size="sm" className="text-amber-500" /> VIP
              </span>
            )}
          </div>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Icon name="person" size="sm" />
            {data.guest_name} • {SOURCE_LABELS[data.source] || data.source}
            {data.guest_phone && <span dir="ltr">• {data.guest_phone}</span>}
          </p>
        </div>

        <div className="flex gap-3">
          {data.status === "confirmed" && (
            <button onClick={() => handleAction("check_in")} disabled={!!actionLoading}
              className="bg-primary text-white px-6 py-2.5 rounded-xl min-h-[44px] font-bold text-sm shadow-md hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
              <Icon name="login" size="sm" />
              {actionLoading === "check_in" ? "מבצע..." : "הגעה"}
            </button>
          )}
          {data.status === "checked_in" && (
            <button onClick={() => handleAction("check_out")} disabled={!!actionLoading}
              className="bg-amber-500 text-white px-6 py-2.5 rounded-xl min-h-[44px] font-bold text-sm shadow-md hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
              <Icon name="logout" size="sm" />
              {actionLoading === "check_out" ? "מבצע..." : "עזיבה"}
            </button>
          )}
          <button onClick={() => handleAction("vip")} disabled={!!actionLoading}
            className="bg-card text-foreground px-5 py-2.5 rounded-xl min-h-[44px] font-bold text-sm shadow-sm border border-border/20 hover:bg-accent transition-all flex items-center gap-2 disabled:opacity-50">
            <Icon name="star" size="sm" className={data.is_vip ? "text-amber-500" : ""} />
            {data.is_vip ? "הסר VIP" : "VIP"}
          </button>
          {data.status !== "cancelled" && data.status !== "checked_out" && (
            <button onClick={() => handleAction("cancel")} disabled={!!actionLoading}
              className="bg-card text-destructive px-5 py-2.5 rounded-xl min-h-[44px] font-bold text-sm shadow-sm border border-destructive/20 hover:bg-red-50 transition-all flex items-center gap-2 disabled:opacity-50">
              <Icon name="block" size="sm" />
              ביטול
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Main content */}
        <div className="col-span-8 max-lg:col-span-12 space-y-6">
          {/* Tabs */}
          <nav className="flex border-b border-border/20 gap-8">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`pb-4 border-b-2 text-sm font-medium transition-colors ${
                  tab === t.key ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-primary"
                }`}>
                {t.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          {tab === "details" && (
            <div className="space-y-6">
              {/* Guest card */}
              <div className="bg-card rounded-[20px] p-8 shadow-sm border border-border/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary">
                    <Icon name="person" />
                  </div>
                  <h2 className="text-xl font-bold font-headline">פרטי אורח</h2>
                </div>
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div><span className="text-muted-foreground block text-xs mb-1">שם מלא</span><span className="font-bold">{data.guest_name}</span></div>
                  <div><span className="text-muted-foreground block text-xs mb-1">טלפון</span><span className="font-bold" dir="ltr">{data.guest_phone || "—"}</span></div>
                  <div><span className="text-muted-foreground block text-xs mb-1">אימייל</span><span className="font-bold" dir="ltr">{data.guest_email || "—"}</span></div>
                  <div><span className="text-muted-foreground block text-xs mb-1">מדינה</span><span className="font-bold">{data.guest_country || "IL"}</span></div>
                  <div><span className="text-muted-foreground block text-xs mb-1">ת.ז./דרכון</span><span className="font-bold" dir="ltr">{data.guest_id_number || "—"}</span></div>
                  <div><span className="text-muted-foreground block text-xs mb-1">שפה</span><span className="font-bold">{data.guest_language === "he" ? "עברית" : data.guest_language || "—"}</span></div>
                </div>
              </div>

              {/* Dates card */}
              <div className="bg-card rounded-[20px] p-8 shadow-sm border border-border/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary">
                    <Icon name="calendar_today" />
                  </div>
                  <h2 className="text-xl font-bold font-headline">מועדי שהייה</h2>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-accent rounded-[20px] p-5 text-center">
                    <p className="text-xs text-muted-foreground mb-1">כניסה</p>
                    <p className="text-lg font-bold">{fmtDate(data.check_in)}</p>
                  </div>
                  <div className="bg-accent rounded-[20px] p-5 text-center">
                    <p className="text-xs text-muted-foreground mb-1">יציאה</p>
                    <p className="text-lg font-bold">{fmtDate(data.check_out)}</p>
                  </div>
                  <div className="bg-primary/5 rounded-[20px] p-5 text-center">
                    <p className="text-xs text-muted-foreground mb-1">לילות</p>
                    <p className="text-lg font-bold text-primary">{n}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-4 text-center text-sm">
                  <div><span className="text-muted-foreground block text-xs">מבוגרים</span><span className="font-bold">{data.adults}</span></div>
                  <div><span className="text-muted-foreground block text-xs">ילדים</span><span className="font-bold">{data.children || 0}</span></div>
                  <div><span className="text-muted-foreground block text-xs">תינוקות</span><span className="font-bold">{data.infants || 0}</span></div>
                  <div><span className="text-muted-foreground block text-xs">ארוחות</span><span className="font-bold">{data.meal_plan === "none" ? "ללא" : data.meal_plan || "ללא"}</span></div>
                </div>
              </div>
            </div>
          )}

          {tab === "rooms" && (
            <div className="space-y-4">
              {data.rooms?.map((rm: { id: string; room_number: string; room_type_name: string; floor_name: string; building_name: string; rate_per_night: number; check_in: string | Date; check_out: string | Date; room_status: string }) => (
                <div key={rm.id} className="bg-card rounded-[20px] p-6 shadow-sm border border-border/20 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold bg-accent w-14 h-14 flex items-center justify-center rounded-xl">{rm.room_number}</span>
                    <div>
                      <p className="font-bold">{rm.room_type_name}</p>
                      <p className="text-xs text-muted-foreground">{rm.floor_name} • {rm.building_name}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(rm.check_in)} — {fmtDate(rm.check_out)}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold">{Number(rm.rate_per_night).toLocaleString()} ₪</p>
                    <p className="text-xs text-muted-foreground">ללילה</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "notes" && (
            <div className="space-y-4">
              {[
                { label: "בקשות מיוחדות", value: data.special_requests, icon: "priority_high", color: "bg-amber-50 dark:bg-amber-950/20" },
                { label: "הערות כלליות", value: data.general_notes, icon: "sticky_note_2", color: "bg-card" },
                { label: "הערות פנימיות", value: data.internal_notes, icon: "lock", color: "bg-card" },
                { label: "הערות קבלה", value: data.reception_notes, icon: "desk", color: "bg-card" },
                { label: "הערות ניקיון", value: data.cleaning_notes, icon: "cleaning_services", color: "bg-card" },
                { label: "הערות תחזוקה", value: data.maintenance_notes, icon: "build", color: "bg-card" },
              ].map((note) => (
                <div key={note.label} className={`${note.color} rounded-[20px] p-6 shadow-sm border border-border/20`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name={note.icon} size="sm" className="text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground">{note.label}</span>
                  </div>
                  <p className="text-sm">{note.value || <span className="text-muted-foreground italic">אין הערות</span>}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "logs" && (
            <div className="bg-card rounded-[20px] p-6 shadow-sm border border-border/20">
              {data.logs?.length > 0 ? (
                <div className="space-y-4">
                  {data.logs.map((log: { id: string; action: string; entity_type: string; user_name: string; created_at: string | Date; changes: Record<string, unknown> }) => (
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
              ) : (
                <p className="text-center text-muted-foreground py-8">אין רשומות</p>
              )}
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        <div className="col-span-4 max-lg:col-span-12 sticky top-4">
          <div className="bg-card rounded-[20px] overflow-hidden shadow-sm border border-border/20">
            <div className="p-6 bg-gradient-to-br from-primary to-primary-container text-white">
              <h2 className="text-xl font-bold mb-1 font-headline">סיכום כספי</h2>
              <p className="text-xs opacity-80">פירוט תשלומים ויתרות</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">סטטוס תשלום</span>
                <span className="font-bold">{PAYMENT_LABELS[data.payment_status] || data.payment_status}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">סה"כ</span>
                <span className="font-bold">{Number(data.total_price).toLocaleString()} ₪</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">שולם</span>
                <span className="font-bold text-emerald-600">{Number(data.total_paid).toLocaleString()} ₪</span>
              </div>
              {Number(data.deposit) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">פיקדון</span>
                  <span className="font-bold">{Number(data.deposit).toLocaleString()} ₪</span>
                </div>
              )}
              <div className="border-t border-border/20 pt-4 flex justify-between items-center">
                <span className="font-bold">יתרה</span>
                <span className={`text-xl font-extrabold ${Number(data.balance_due) > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {Number(data.balance_due).toLocaleString()} ₪
                </span>
              </div>

              {data.tax_exempt && (
                <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-950/20 text-primary rounded-xl p-3 mt-2">
                  <Icon name="public" size="sm" />
                  פטור ממע"מ — תושב חוץ
                </div>
              )}

              {/* Payments list */}
              {data.payments?.length > 0 && (
                <div className="border-t border-border/20 pt-4">
                  <p className="text-xs font-bold text-muted-foreground mb-3">היסטוריית תשלומים</p>
                  {data.payments.map((p: { id: string; amount: number; method: string; created_at: string | Date }) => (
                    <div key={p.id} className="flex justify-between text-xs mb-2">
                      <span className="text-muted-foreground">{fmtDateTime(p.created_at)} • {p.method}</span>
                      <span className="font-bold">{Number(p.amount).toLocaleString()} ₪</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
