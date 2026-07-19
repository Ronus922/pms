"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Icon } from "@/components/shared/Icon"
import { ChannelsShell } from "./ChannelsShell"
import { EventStatusPill } from "./shared/StatusPills"
import { JsonViewer } from "./shared/JsonViewer"
import {
  getWebhookEvent,
  listWebhookEvents,
  replayWebhookEvent,
} from "@/lib/actions/channex"

interface Row {
  id: string
  event_name: string
  channex_property_id: string | null
  status: string
  received_at: string
  processed_at: string | null
  error: string | null
}

interface Detail {
  id: string
  event_name: string
  payload: unknown
  headers: unknown
  source_ip: string | null
  status: string
  received_at: string
  error: string | null
}

export function WebhookEventsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>("all")
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listWebhookEvents({ status, limit: 200 })
    setRows(data)
    setLoading(false)
  }, [status])

  useEffect(() => {
    load()
    const i = setInterval(load, 10_000)
    return () => clearInterval(i)
  }, [load])

  const openDetail = async (id: string) => {
    setLoadingDetail(true)
    const d = await getWebhookEvent(id)
    setLoadingDetail(false)
    if (d) setDetail(d)
    else toast.error("האירוע לא נמצא")
  }

  const handleReplay = async (id: string) => {
    const res = await replayWebhookEvent(id)
    if (res.success) {
      toast.success("האירוע נוסף שוב לתור עיבוד")
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
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-accent/60 border-0 rounded-xl px-4 py-2.5 pe-9 text-xs font-bold min-h-[44px] appearance-none cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="all">כל הסטטוסים</option>
            <option value="received">התקבל</option>
            <option value="processed">עובד</option>
            <option value="failed">נכשל</option>
            <option value="ignored">התעלם</option>
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
        <div className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_0.5fr] bg-accent/50 px-4 py-3 text-[10px] font-bold text-muted-foreground">
          <div>סוג אירוע</div>
          <div>Property</div>
          <div>סטטוס</div>
          <div>התקבל</div>
          <div>עובד</div>
          <div className="text-center">פעולות</div>
        </div>
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            אין אירועי webhook להצגה
          </div>
        ) : (
          <div className="divide-y divide-border/10 max-h-[600px] overflow-y-auto">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => openDetail(r.id)}
                className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_0.5fr] px-4 py-3 items-center text-right hover:bg-accent/40 transition-colors text-xs"
              >
                <div className="font-bold truncate" dir="ltr">
                  {r.event_name}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground truncate" dir="ltr">
                  {r.channex_property_id?.slice(0, 8) ?? "—"}
                </div>
                <div>
                  <EventStatusPill status={r.status} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(r.received_at).toLocaleString("he-IL")}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {r.processed_at
                    ? new Date(r.processed_at).toLocaleString("he-IL")
                    : "—"}
                </div>
                <div
                  className="flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleReplay(r.id)}
                    className="h-8 w-8 min-h-[36px] min-w-[36px] rounded-lg bg-accent hover:bg-primary hover:text-primary-foreground text-muted-foreground flex items-center justify-center"
                    title="הרץ שוב"
                  >
                    <Icon name="replay" size="sm" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      {(loadingDetail || detail) && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-card rounded-[20px] shadow-2xl border border-border/20 w-full max-w-3xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail ? (
              <div className="py-16 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : detail ? (
              <>
                <div className="flex items-center justify-between p-5 border-b border-border/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <h3 className="text-base font-bold">אירוע Webhook</h3>
                    <EventStatusPill status={detail.status} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl hover:bg-accent flex items-center justify-center"
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </div>
                <div className="p-5 flex flex-col gap-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <KV label="אירוע" value={detail.event_name} dir="ltr" />
                    <KV label="IP מקור" value={detail.source_ip ?? "—"} dir="ltr" />
                    <KV
                      label="התקבל"
                      value={new Date(detail.received_at).toLocaleString("he-IL")}
                    />
                    <KV label="סטטוס" value={detail.status} />
                  </div>
                  {detail.error && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-destructive text-[11px]">
                      {detail.error}
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[11px] font-bold text-muted-foreground">
                      Payload
                    </div>
                    <JsonViewer value={detail.payload} maxHeight={300} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[11px] font-bold text-muted-foreground">
                      Headers
                    </div>
                    <JsonViewer value={detail.headers} maxHeight={200} />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </ChannelsShell>
  )
}

function KV({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div className="bg-accent/40 rounded-xl p-3">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className="text-sm font-mono" dir={dir}>
        {value}
      </div>
    </div>
  )
}
