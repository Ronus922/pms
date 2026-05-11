"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/shared/Icon"
import { ChannelsShell } from "./ChannelsShell"
import { listRoomTypeMapping } from "@/lib/actions/channex"

interface Row {
  room_type_id: string
  room_type_name: string
  room_count: number
  base_price: number
  max_adults: number
  max_children: number
  channex_room_type_id: string | null
  channex_title: string | null
  has_rate_plan: boolean
}

export function MappingPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listRoomTypeMapping()
    setRows(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = rows.filter((r) =>
    r.room_type_name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const mappedCount = rows.filter((r) => r.channex_room_type_id).length
  const unmappedCount = rows.length - mappedCount

  return (
    <ChannelsShell>
      {/* Summary bar */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Icon name="link" size="md" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground">
                סוגי חדרים ממופים
              </span>
              <span className="text-lg font-extrabold">
                {mappedCount} / {rows.length}
              </span>
            </div>
          </div>
          {unmappedCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Icon name="warning" size="md" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground">
                  לא ממופים
                </span>
                <span className="text-lg font-extrabold">{unmappedCount}</span>
              </div>
            </div>
          )}
        </div>
        {unmappedCount > 0 && (
          <Link
            href="/channels"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            צור מיפוי אוטומטי דרך "סנכרון ראשוני" <Icon name="arrow_forward" size="sm" />
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="bg-card rounded-[20px] p-4 shadow-sm border border-border/20">
        <div className="relative">
          <input
            type="text"
            placeholder="חיפוש לפי שם סוג חדר..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-accent/60 border-0 rounded-xl px-4 py-3 pe-10 text-sm min-h-[48px] focus:ring-2 focus:ring-primary/20 outline-none"
          />
          <Icon
            name="search"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-card rounded-[20px] p-16 shadow-sm border border-border/20 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-[20px] p-16 shadow-sm border border-border/20 flex items-center justify-center text-muted-foreground text-sm">
          אין סוגי חדרים להצגה
        </div>
      ) : (
        <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden">
          <div className="grid grid-cols-[1.5fr_0.6fr_0.8fr_0.8fr_1fr_0.6fr] bg-accent/50 px-5 py-3 text-[10px] font-bold text-muted-foreground">
            <div>סוג חדר</div>
            <div className="text-center">חדרים</div>
            <div className="text-center">אכלוס</div>
            <div className="text-center">מחיר בסיס</div>
            <div>מיפוי Channex</div>
            <div className="text-center">תוכנית מחיר</div>
          </div>
          <div className="divide-y divide-border/10">
            {filtered.map((r) => (
              <div
                key={r.room_type_id}
                className="grid grid-cols-[1.5fr_0.6fr_0.8fr_0.8fr_1fr_0.6fr] px-5 py-4 items-center hover:bg-accent/40 transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-bold truncate">
                    {r.room_type_name}
                  </span>
                  {r.channex_title && (
                    <span className="text-[10px] text-muted-foreground truncate" dir="ltr">
                      {r.channex_title}
                    </span>
                  )}
                </div>
                <div className="text-center text-xs font-bold">{r.room_count}</div>
                <div className="text-center text-xs font-bold">
                  {r.max_adults}A{r.max_children > 0 ? ` · ${r.max_children}C` : ""}
                </div>
                <div className="text-center text-xs font-bold">
                  ₪{r.base_price}
                </div>
                <div className="min-w-0">
                  {r.channex_room_type_id ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1"
                      title={r.channex_room_type_id}
                    >
                      <Icon name="check_circle" size="sm" />
                      ממופה
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                      <Icon name="error_outline" size="sm" />
                      לא ממופה
                    </span>
                  )}
                </div>
                <div className="text-center">
                  {r.has_rate_plan ? (
                    <Icon name="check_circle" size="sm" className="text-emerald-600 inline" />
                  ) : (
                    <Icon name="remove" size="sm" className="text-muted-foreground inline" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help */}
      <div className="bg-accent/40 rounded-[20px] p-5 border border-border/20">
        <div className="flex items-start gap-3">
          <Icon name="info" size="md" className="text-primary shrink-0" />
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="font-bold text-foreground">איך המיפוי עובד?</span>
            <span>
              הסנכרון הראשוני יוצר אוטומטית property, room types ו-rate plans ב-Channex עבור כל סוגי החדרים הפעילים.
            </span>
            <span>
              חיבור ערוצי OTA (Booking.com, Airbnb, Expedia) מתבצע ידנית ב-Extranet של Channex לאחר הסנכרון הראשוני.
            </span>
          </div>
        </div>
      </div>
    </ChannelsShell>
  )
}
