"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Icon } from "@/components/shared/Icon"
import { ChannelsShell } from "./ChannelsShell"
import {
  ProcessedStatusPill,
  RevisionStatusPill,
} from "./shared/StatusPills"
import { JsonViewer } from "./shared/JsonViewer"
import { listBookingRevisions, retryBookingImport } from "@/lib/actions/channex"

interface Row {
  id: string
  unique_id: string
  ota_name: string | null
  status: string
  processed_status: string
  ack_status: string
  arrival_date: string | null
  departure_date: string | null
  received_at: string
  error: string | null
  reservation_id: string | null
  payload: Record<string, unknown>
}

export function BookingsInboxPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [processedStatus, setProcessedStatus] = useState<string>("all")
  const [selected, setSelected] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listBookingRevisions({ processedStatus, limit: 200 })
    setRows(data)
    setLoading(false)
  }, [processedStatus])

  useEffect(() => {
    load()
    const i = setInterval(load, 15_000)
    return () => clearInterval(i)
  }, [load])

  const handleRetry = async (id: string) => {
    const res = await retryBookingImport(id)
    if (res.success) {
      toast.success("נשלחה בקשה למשיכת הזמנות מחדש")
      load()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <ChannelsShell>
      {/* Filter */}
      <div className="bg-card rounded-[20px] p-4 shadow-sm border border-border/20 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select
            value={processedStatus}
            onChange={(e) => setProcessedStatus(e.target.value)}
            className="bg-accent/60 border-0 rounded-xl px-4 py-2.5 pe-9 text-xs font-bold min-h-[44px] appearance-none cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="all">כל ההזמנות</option>
            <option value="pending">ממתין</option>
            <option value="imported">יובא</option>
            <option value="unmapped">לא ממופה</option>
            <option value="failed">נכשל</option>
            <option value="skipped">דולג</option>
          </select>
          <Icon
            name="expand_more"
            size="sm"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>
        <button
          type="button"
          onClick={load}
          className="bg-accent hover:bg-accent/80 text-foreground px-4 py-2.5 rounded-xl font-bold text-xs min-h-[44px] flex items-center gap-2"
        >
          <Icon name="refresh" size="sm" />
          רענון
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden">
        <div className="grid grid-cols-[1fr_1.2fr_0.7fr_1.2fr_1fr_1fr_0.5fr] bg-accent/50 px-4 py-3 text-[10px] font-bold text-muted-foreground">
          <div>ערוץ</div>
          <div>מזהה הזמנה</div>
          <div>סטטוס</div>
          <div>הגעה → עזיבה</div>
          <div>ייבוא</div>
          <div>אישור קבלה</div>
          <div className="text-center">פעולות</div>
        </div>
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            אין הזמנות להצגה
          </div>
        ) : (
          <div className="divide-y divide-border/10 max-h-[600px] overflow-y-auto">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className="grid grid-cols-[1fr_1.2fr_0.7fr_1.2fr_1fr_1fr_0.5fr] px-4 py-3 items-center text-right hover:bg-accent/40 transition-colors text-xs"
              >
                <div className="font-bold truncate">{r.ota_name ?? "—"}</div>
                <div className="font-mono text-[10px] text-muted-foreground truncate" dir="ltr">
                  {r.unique_id}
                </div>
                <div>
                  <RevisionStatusPill status={r.status} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {r.arrival_date ?? "—"} → {r.departure_date ?? "—"}
                </div>
                <div>
                  <ProcessedStatusPill status={r.processed_status} />
                </div>
                <div className="text-[10px] font-bold">
                  {r.ack_status === "acked" ? (
                    <span className="text-emerald-700">אושר</span>
                  ) : r.ack_status === "ack_failed" ? (
                    <span className="text-destructive">נכשל</span>
                  ) : (
                    <span className="text-muted-foreground">ממתין</span>
                  )}
                </div>
                <div
                  className="flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleRetry(r.id)}
                    className="h-8 w-8 min-h-[36px] min-w-[36px] rounded-lg bg-accent hover:bg-primary hover:text-primary-foreground text-muted-foreground flex items-center justify-center"
                    title="משיכה מחדש"
                  >
                    <Icon name="replay" size="sm" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details panel */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card rounded-[20px] shadow-2xl border border-border/20 w-full max-w-3xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border/20">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <h3 className="text-base font-bold">פרטי הזמנה</h3>
                <RevisionStatusPill status={selected.status} />
                <ProcessedStatusPill status={selected.processed_status} />
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl hover:bg-accent flex items-center justify-center"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-accent/40 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-muted-foreground">
                    ערוץ
                  </div>
                  <div className="text-sm font-bold">{selected.ota_name ?? "—"}</div>
                </div>
                <div className="bg-accent/40 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-muted-foreground">
                    מזהה
                  </div>
                  <div className="text-sm font-mono" dir="ltr">
                    {selected.unique_id}
                  </div>
                </div>
                <div className="bg-accent/40 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-muted-foreground">
                    הגעה
                  </div>
                  <div className="text-sm font-bold">{selected.arrival_date ?? "—"}</div>
                </div>
                <div className="bg-accent/40 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-muted-foreground">
                    עזיבה
                  </div>
                  <div className="text-sm font-bold">{selected.departure_date ?? "—"}</div>
                </div>
              </div>
              {selected.error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-destructive text-[11px]">
                  {selected.error}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] font-bold text-muted-foreground">
                  Payload מלא
                </div>
                <JsonViewer value={selected.payload} maxHeight={320} />
              </div>
            </div>
          </div>
        </div>
      )}
    </ChannelsShell>
  )
}
