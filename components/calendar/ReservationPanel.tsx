"use client"

import { useEffect, useState, useCallback } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { getReservationDetails, updateReservationStatus, toggleVip, cancelReservation } from "@/lib/actions/reservations"
import { STATUS_LABELS, PAYMENT_LABELS, SOURCE_LABELS } from "@/lib/constants/reservation"

function fmtDate(v: string | Date): string {
  if (!v) return ""
  const d = typeof v === "string" ? new Date(v) : v
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

function calcNights(ci: string | Date, co: string | Date): number {
  const a = typeof ci === "string" ? new Date(ci) : ci
  const b = typeof co === "string" ? new Date(co) : co
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

type Tab = "details" | "rooms" | "notes" | "payments"

interface ReservationPanelProps {
  reservationId: string | null
  tenantId: string
  onClose: () => void
  onUpdate: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReservationPanel({ reservationId, tenantId, onClose, onUpdate }: ReservationPanelProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState("")
  const [tab, setTab] = useState<Tab>("details")

  const load = useCallback(async () => {
    if (!reservationId) return
    setLoading(true)
    const result = await getReservationDetails(reservationId)
    setData(result)
    setLoading(false)
  }, [reservationId])

  useEffect(() => { load(); setTab("details") }, [load])

  async function handleAction(action: string) {
    if (!data) return
    setActionLoading(action)
    if (action === "check_in") await updateReservationStatus(data.id, tenantId, "checked_in")
    else if (action === "check_out") await updateReservationStatus(data.id, tenantId, "checked_out")
    else if (action === "vip") await toggleVip(data.id, tenantId)
    else if (action === "cancel") await cancelReservation(data.id, tenantId)
    setActionLoading("")
    await load()
    onUpdate()
  }

  const nights = data ? calcNights(data.check_in, data.check_out) : 0

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "details", label: "פרטים", icon: "info" },
    { key: "rooms", label: "חדרים", icon: "bed" },
    { key: "notes", label: "הערות", icon: "sticky_note_2" },
    { key: "payments", label: "תשלום", icon: "payments" },
  ]

  return (
    <SidePanel
      isOpen={!!reservationId}
      onClose={onClose}
      title={data ? `הזמנה ${data.reservation_number}` : "טוען..."}
      subtitle={data ? `${data.guest_name} • ${nights} לילות` : undefined}
    >
      {loading || !data ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="hourglass_empty" size="xl" className="text-muted-foreground opacity-30" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
              {STATUS_LABELS[data.status] || data.status}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              {PAYMENT_LABELS[data.payment_status] || data.payment_status}
            </span>
            {(data.is_vip || data.guest_vip) && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 flex items-center gap-1">
                <Icon name="star" filled size="sm" className="text-amber-500" /> VIP
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent text-muted-foreground">
              {SOURCE_LABELS[data.source] || data.source}
            </span>
          </div>

          {/* Summary row — like the reference */}
          <div className="grid grid-cols-3 gap-4 bg-accent/50 rounded-xl p-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">תאריך הגעה</p>
              <p className="text-sm font-bold mt-1">{fmtDate(data.check_in)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">תאריך עזיבה</p>
              <p className="text-sm font-bold mt-1">{fmtDate(data.check_out)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">סך הכל</p>
              <p className="text-sm font-bold mt-1 text-primary">{Number(data.total_price).toLocaleString()} ₪</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border/50">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon name={t.icon} size="sm" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "details" && (
            <div className="space-y-4">
              {/* Guest */}
              <div className="bg-accent/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary-container flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {data.guest_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold">{data.guest_name}</p>
                    <p className="text-xs text-muted-foreground">{data.guest_country || "ישראל"}</p>
                  </div>
                </div>
                {data.guest_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name="phone" size="sm" className="text-muted-foreground" />
                    <span dir="ltr">{data.guest_phone}</span>
                  </div>
                )}
                {data.guest_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name="email" size="sm" className="text-muted-foreground" />
                    <span dir="ltr">{data.guest_email}</span>
                  </div>
                )}
              </div>

              {/* Stay details */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-accent/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">מבוגרים</p>
                  <p className="text-lg font-bold mt-1">{data.adults}</p>
                </div>
                <div className="bg-accent/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">ילדים</p>
                  <p className="text-lg font-bold mt-1">{data.children || 0}</p>
                </div>
                <div className="bg-accent/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">תינוקות</p>
                  <p className="text-lg font-bold mt-1">{data.infants || 0}</p>
                </div>
                <div className="bg-accent/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">לילות</p>
                  <p className="text-lg font-bold mt-1">{nights}</p>
                </div>
              </div>

              {/* Meal & extras */}
              {data.meal_plan && data.meal_plan !== "none" && (
                <div className="flex items-center gap-2 text-sm bg-accent/50 rounded-xl p-3">
                  <Icon name="restaurant" size="sm" className="text-muted-foreground" />
                  <span>
                    {data.meal_plan === "breakfast" ? "ארוחת בוקר" :
                     data.meal_plan === "half_board" ? "חצי פנסיון" :
                     data.meal_plan === "full_board" ? "פנסיון מלא" : data.meal_plan}
                  </span>
                </div>
              )}
            </div>
          )}

          {tab === "rooms" && (
            <div className="space-y-3">
              {data.rooms?.map((rm: { room_id: string; room_number: string; room_type_name: string; rate_per_night: number; check_in: string | Date; check_out: string | Date }) => (
                <div key={rm.room_id} className="bg-accent/50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold bg-card w-10 h-10 flex items-center justify-center rounded-xl shadow-sm">
                      {rm.room_number}
                    </span>
                    <div>
                      <p className="text-sm font-bold">{rm.room_type_name}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(rm.check_in)} — {fmtDate(rm.check_out)}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{rm.rate_per_night} ₪</p>
                    <p className="text-xs text-muted-foreground">ללילה</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "notes" && (
            <div className="space-y-4">
              {data.special_requests && (
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                    <Icon name="priority_high" size="sm" /> בקשות מיוחדות
                  </p>
                  <p className="text-sm">{data.special_requests}</p>
                </div>
              )}
              {data.general_notes && (
                <div className="bg-accent/50 rounded-xl p-4">
                  <p className="text-xs font-bold text-muted-foreground mb-2">הערות כלליות</p>
                  <p className="text-sm">{data.general_notes}</p>
                </div>
              )}
              {data.internal_notes && (
                <div className="bg-accent/50 rounded-xl p-4">
                  <p className="text-xs font-bold text-muted-foreground mb-2">הערות פנימיות</p>
                  <p className="text-sm">{data.internal_notes}</p>
                </div>
              )}
              {!data.special_requests && !data.general_notes && !data.internal_notes && (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="sticky_note_2" size="xl" className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">אין הערות</p>
                </div>
              )}
            </div>
          )}

          {tab === "payments" && (
            <div className="space-y-4">
              <div className="bg-accent/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">סה"כ</span>
                  <span className="font-bold">{Number(data.total_price).toLocaleString()} ₪</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">שולם</span>
                  <span className="font-bold text-emerald-600">{Number(data.total_paid).toLocaleString()} ₪</span>
                </div>
                {data.deposit > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">פיקדון</span>
                    <span className="font-bold">{Number(data.deposit).toLocaleString()} ₪</span>
                  </div>
                )}
                {data.discount_percent > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">הנחה</span>
                    <span className="font-bold">{data.discount_percent}%</span>
                  </div>
                )}
                <div className="border-t border-border/50 pt-3 flex justify-between text-sm">
                  <span className="font-bold">יתרה</span>
                  <span className={`font-bold text-lg ${Number(data.balance_due) > 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {Number(data.balance_due).toLocaleString()} ₪
                  </span>
                </div>
              </div>

              {data.tax_exempt && (
                <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-950/20 text-primary rounded-xl p-3">
                  <Icon name="info" size="sm" />
                  פטור ממע"מ — תושב חוץ
                </div>
              )}
            </div>
          )}

          {/* Action Buttons — always visible at bottom */}
          <div className="border-t border-border/50 pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {data.status === "confirmed" && (
                <button
                  onClick={() => handleAction("check_in")}
                  disabled={!!actionLoading}
                  className="flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Icon name="login" size="sm" />
                  {actionLoading === "check_in" ? "מבצע..." : "הגעה"}
                </button>
              )}
              {data.status === "checked_in" && (
                <button
                  onClick={() => handleAction("check_out")}
                  disabled={!!actionLoading}
                  className="flex items-center justify-center gap-2 bg-amber-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  <Icon name="logout" size="sm" />
                  {actionLoading === "check_out" ? "מבצע..." : "עזיבה"}
                </button>
              )}
              <button
                onClick={() => handleAction("vip")}
                disabled={!!actionLoading}
                className="flex items-center justify-center gap-2 border border-border py-3 rounded-xl font-medium text-sm hover:bg-accent transition-colors disabled:opacity-50"
              >
                <Icon name="star" size="sm" className={data.is_vip ? "text-amber-500" : ""} />
                {data.is_vip ? "הסר VIP" : "סמן VIP"}
              </button>
              {data.status !== "cancelled" && data.status !== "checked_out" && (
                <button
                  onClick={() => handleAction("cancel")}
                  disabled={!!actionLoading}
                  className="flex items-center justify-center gap-2 border border-destructive/30 text-destructive py-3 rounded-xl font-medium text-sm hover:bg-destructive/5 transition-colors disabled:opacity-50"
                >
                  <Icon name="block" size="sm" />
                  {actionLoading === "cancel" ? "מבטל..." : "ביטול"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button className="flex items-center justify-center gap-1.5 border border-border py-2.5 rounded-xl text-xs font-medium hover:bg-accent transition-colors">
                <Icon name="edit" size="sm" /> שינוי
              </button>
              <button className="flex items-center justify-center gap-1.5 border border-border py-2.5 rounded-xl text-xs font-medium hover:bg-accent transition-colors">
                <Icon name="mail" size="sm" /> שלח מכתב
              </button>
              <button className="flex items-center justify-center gap-1.5 border border-border py-2.5 rounded-xl text-xs font-medium hover:bg-accent transition-colors">
                <Icon name="receipt_long" size="sm" /> חשבון
              </button>
            </div>
          </div>
        </div>
      )}
    </SidePanel>
  )
}
