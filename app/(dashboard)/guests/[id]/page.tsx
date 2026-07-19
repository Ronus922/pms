"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Icon } from "@/components/shared/Icon"
import { getGuestProfile } from "@/lib/actions/guest-profile"
import Link from "next/link"
import { STATUS_LABELS } from "@/lib/constants/reservation"

const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"]

function fmtDate(v: string | Date): string {
  if (!v) return "—"
  const d = typeof v === "string" ? new Date(v) : v
  return `${d.getDate()} ${HEB_MONTHS[d.getMonth()]}, ${d.getFullYear()}`
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary", checked_in: "bg-emerald-50 text-emerald-700",
  checked_out: "bg-accent text-muted-foreground", cancelled: "bg-red-50 text-red-700",
}

export default function GuestProfilePage() {
  const params = useParams()
  const guestId = params.id as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getGuestProfile(guestId)
    setData(result)
    setLoading(false)
  }, [guestId])

  useEffect(() => { load() }, [load])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Icon name="hourglass_empty" size="xl" className="text-muted-foreground opacity-30" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-md">
              {data.full_name?.charAt(0)}
            </div>
            {data.is_vip && (
              <span className="absolute -bottom-1 right-1/2 translate-x-1/2 bg-amber-500 text-white text-[12px] px-3 py-0.5 rounded-full font-bold shadow-md">VIP</span>
            )}
          </div>
          <div>
            <h1 className="text-4xl font-extrabold font-headline">{data.full_name}</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1 text-sm">
              <Icon name="badge" size="sm" />
              ID: #{data.id.slice(0, 8)} • אורח מאז {fmtDate(data.created_at)}
            </p>
            <div className="flex gap-4 mt-2">
              {data.email && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Icon name="mail" size="sm" /> <span dir="ltr">{data.email}</span>
                </span>
              )}
              {data.phone && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Icon name="call" size="sm" /> <span dir="ltr">{data.phone}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="btn btn-outline">
            <Icon name="edit" size="sm" /> ערוך פרופיל
          </button>
          <button className="btn btn-primary">
            <Icon name="add" size="sm" /> הזמנה חדשה
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Timeline */}
        <div className="col-span-8 max-lg:col-span-12">
          <div className="bg-card rounded-[20px] p-8 shadow-sm border border-border/20">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold font-headline flex items-center gap-3">
                <Icon name="auto_stories" className="text-primary" />
                היסטוריית שהיות
              </h3>
              <span className="px-3 py-1 bg-accent rounded-full text-xs font-bold text-muted-foreground">
                {data.reservations?.length || 0} הזמנות
              </span>
            </div>

            <div className="space-y-6">
              {data.reservations?.length > 0 ? data.reservations.map((r: { id: string; reservation_number: string; status: string; check_in: string | Date; check_out: string | Date; room_number: string; room_type_name: string; total_price: number; source: string }) => {
                const isFuture = new Date(r.check_in) > new Date()
                return (
                  <Link key={r.id} href={`/reservations/${r.id}`}
                    className="block bg-accent/50 hover:bg-accent p-6 rounded-[20px] border-r-4 border-primary/30 hover:border-primary transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        {isFuture && <span className="bg-primary/10 text-primary text-[11px] px-2.5 py-1 rounded-full font-bold">עתידי</span>}
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_COLORS[r.status] || "bg-accent text-muted-foreground"}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                        <span className="text-sm font-bold text-muted-foreground">{fmtDate(r.check_in)} — {fmtDate(r.check_out)}</span>
                      </div>
                      <span className="text-sm font-bold">{r.reservation_number}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4 text-sm">
                        {r.room_number && (
                          <span className="flex items-center gap-1">
                            <Icon name="bed" size="sm" className="text-muted-foreground" />
                            {r.room_number} — {r.room_type_name}
                          </span>
                        )}
                      </div>
                      <span className="text-lg font-extrabold text-primary">₪{Number(r.total_price).toLocaleString()}</span>
                    </div>
                  </Link>
                )
              }) : (
                <p className="text-center text-muted-foreground py-8">אין הזמנות</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="col-span-4 max-lg:col-span-12 sticky top-4 space-y-6">
          <div className="bg-card rounded-[20px] overflow-hidden shadow-sm border border-border/20">
            <div className="p-6 bg-gradient-to-br from-primary to-primary-container text-primary-foreground">
              <h2 className="text-xl font-bold font-headline">סטטיסטיקות</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-accent rounded-[20px] p-5 text-center">
                  <p className="text-2xl font-extrabold">{data.total_reservations || 0}</p>
                  <p className="text-[12px] text-muted-foreground font-bold">שהיות</p>
                </div>
                <div className="bg-accent rounded-[20px] p-5 text-center">
                  <p className="text-2xl font-extrabold text-primary">₪{Number(data.total_revenue || 0).toLocaleString()}</p>
                  <p className="text-[12px] text-muted-foreground font-bold">הכנסות</p>
                </div>
                <div className="bg-accent rounded-[20px] p-5 text-center">
                  <p className="text-2xl font-extrabold">{data.avgNights || 0}</p>
                  <p className="text-[12px] text-muted-foreground font-bold">ממוצע לילות</p>
                </div>
                <div className="bg-accent rounded-[20px] p-5 text-center">
                  <p className="text-2xl font-extrabold text-destructive">{data.total_cancellations || 0}</p>
                  <p className="text-[12px] text-muted-foreground font-bold">ביטולים</p>
                </div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-card rounded-[20px] p-6 shadow-sm border border-border/20">
            <h3 className="text-sm font-bold text-muted-foreground mb-4">העדפות</h3>
            <div className="space-y-3 text-sm">
              {data.special_preferences && (
                <div className="flex items-start gap-2">
                  <Icon name="favorite" size="sm" className="text-tertiary flex-shrink-0 mt-0.5" />
                  <span>{data.special_preferences}</span>
                </div>
              )}
              {data.kitchen_notes && (
                <div className="flex items-start gap-2">
                  <Icon name="restaurant" size="sm" className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <span>{data.kitchen_notes}</span>
                </div>
              )}
              {data.cleaning_notes && (
                <div className="flex items-start gap-2">
                  <Icon name="cleaning_services" size="sm" className="text-primary flex-shrink-0 mt-0.5" />
                  <span>{data.cleaning_notes}</span>
                </div>
              )}
              {!data.special_preferences && !data.kitchen_notes && !data.cleaning_notes && (
                <p className="text-muted-foreground italic">לא הוגדרו העדפות</p>
              )}
            </div>
          </div>

          {/* Tags */}
          {data.tags?.length > 0 && (
            <div className="bg-card rounded-[20px] p-6 shadow-sm border border-border/20">
              <h3 className="text-sm font-bold text-muted-foreground mb-3">תגיות</h3>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1 bg-accent rounded-full text-xs font-bold">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
