"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Icon } from "@/components/shared/Icon"
import { ChannelsShell } from "./ChannelsShell"
import { JobStatusPill } from "./shared/StatusPills"
import { JsonViewer } from "./shared/JsonViewer"
import {
  cancelJob,
  listSyncJobs,
  retryAllFailedJobs,
  retryJob,
  runChannexWorkerOnce,
} from "@/lib/actions/channex"
import type { ChannelSyncJobRow } from "@/lib/integrations/channex/types"

type StatusFilter = "all" | ChannelSyncJobRow["status"]
type JobTypeFilter = "all" | ChannelSyncJobRow["job_type"]

export function SyncMonitorPage() {
  const [rows, setRows] = useState<ChannelSyncJobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusFilter>("all")
  const [jobType, setJobType] = useState<JobTypeFilter>("all")
  const [selected, setSelected] = useState<ChannelSyncJobRow | null>(null)
  const [running, setRunning] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listSyncJobs({ status, jobType, limit: 200 })
    setRows(data)
    setLoading(false)
  }, [status, jobType])

  useEffect(() => {
    load()
    const i = setInterval(load, 10_000)
    return () => clearInterval(i)
  }, [load])

  const handleRunWorker = async () => {
    setRunning(true)
    const res = await runChannexWorkerOnce(100)
    setRunning(false)
    if (res.success) {
      toast.success(
        `${res.picked} עובדו · ${res.done} הצלחה · ${res.failed} נכשלו · ${res.pendingAfter} ממתינים`,
      )
      load()
    } else {
      toast.error(res.error)
    }
  }

  const handleRetryAll = async () => {
    if (!confirm("לשלוח שוב את כל המשימות שנכשלו?")) return
    setRetrying(true)
    const res = await retryAllFailedJobs()
    setRetrying(false)
    if (res.success) {
      toast.success(`${res.count} משימות נשלחו מחדש לתור`)
      load()
    } else {
      toast.error(res.error)
    }
  }

  const handleRowRetry = async (jobId: string) => {
    const res = await retryJob(jobId)
    if (res.success) {
      toast.success("המשימה נשלחה לתור")
      load()
    } else toast.error(res.error)
  }

  const handleRowCancel = async (jobId: string) => {
    const res = await cancelJob(jobId)
    if (res.success) {
      toast.success("המשימה בוטלה")
      load()
    } else toast.error(res.error)
  }

  return (
    <ChannelsShell>
      {/* Toolbar */}
      <div className="bg-card rounded-[20px] p-4 shadow-sm border border-border/20 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <SelectPill
            value={status}
            onChange={(v) => setStatus(v as StatusFilter)}
            options={[
              { value: "all", label: "כל הסטטוסים" },
              { value: "pending", label: "ממתין" },
              { value: "retry", label: "נסיון חוזר" },
              { value: "running", label: "רץ" },
              { value: "done", label: "הצלחה" },
              { value: "failed", label: "נכשל" },
              { value: "cancelled", label: "בוטל" },
            ]}
          />
          <SelectPill
            value={jobType}
            onChange={(v) => setJobType(v as JobTypeFilter)}
            options={[
              { value: "all", label: "כל הסוגים" },
              { value: "ari_push", label: "ARI" },
              { value: "availability_push", label: "זמינות" },
              { value: "booking_pull", label: "משיכת הזמנות" },
              { value: "initial_sync", label: "סנכרון ראשוני" },
              { value: "webhook_process", label: "Webhook" },
              { value: "ack_booking", label: "אישור הזמנה" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunWorker}
            disabled={running}
            className="btn btn-primary"
          >
            <Icon name={running ? "hourglass_empty" : "play_arrow"} size="sm" />
            הרץ worker עכשיו
          </button>
          <button
            type="button"
            onClick={handleRetryAll}
            disabled={retrying}
            className="bg-accent hover:bg-accent/80 text-foreground px-4 py-2.5 rounded-xl font-bold text-xs min-h-[44px] flex items-center gap-2 disabled:opacity-50"
          >
            <Icon name="replay" size="sm" />
            נסה שוב הכל
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden">
        <div className="grid grid-cols-[0.7fr_1fr_0.8fr_1fr_0.6fr_1fr_0.6fr] bg-accent/50 px-4 py-3 text-[10px] font-bold text-muted-foreground">
          <div>סוג</div>
          <div>סטטוס</div>
          <div className="text-center">נסיונות</div>
          <div>תוזמן ל</div>
          <div>מזהה</div>
          <div>שגיאה אחרונה</div>
          <div className="text-center">פעולות</div>
        </div>
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            אין משימות להצגה
          </div>
        ) : (
          <div className="divide-y divide-border/10 max-h-[600px] overflow-y-auto">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className="grid grid-cols-[0.7fr_1fr_0.8fr_1fr_0.6fr_1fr_0.6fr] px-4 py-3 items-center text-right hover:bg-accent/40 transition-colors text-xs"
              >
                <div className="font-bold truncate">{r.job_type}</div>
                <div>
                  <JobStatusPill status={r.status} />
                </div>
                <div className="text-center font-bold">
                  {r.attempts}/{r.max_attempts}
                </div>
                <div className="text-muted-foreground truncate">
                  {new Date(r.scheduled_for).toLocaleString("he-IL")}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground truncate" dir="ltr">
                  {r.id.slice(0, 8)}
                </div>
                <div className="text-destructive text-[11px] truncate" title={r.last_error ?? ""}>
                  {r.last_error ?? ""}
                </div>
                <div
                  className="flex items-center justify-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(r.status === "failed" ||
                    r.status === "cancelled" ||
                    r.status === "retry") && (
                    <button
                      type="button"
                      onClick={() => handleRowRetry(r.id)}
                      className="h-8 w-8 min-h-[36px] min-w-[36px] rounded-lg bg-accent hover:bg-primary hover:text-white text-muted-foreground flex items-center justify-center"
                      title="נסה שוב"
                    >
                      <Icon name="replay" size="sm" />
                    </button>
                  )}
                  {(r.status === "pending" ||
                    r.status === "retry" ||
                    r.status === "running") && (
                    <button
                      type="button"
                      onClick={() => handleRowCancel(r.id)}
                      className="h-8 w-8 min-h-[36px] min-w-[36px] rounded-lg bg-accent hover:bg-destructive hover:text-white text-muted-foreground flex items-center justify-center"
                      title="בטל"
                    >
                      <Icon name="close" size="sm" />
                    </button>
                  )}
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
            className="bg-card rounded-[20px] shadow-2xl border border-border/20 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border/20">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <h3 className="text-base font-bold">פרטי משימה</h3>
                <JobStatusPill status={selected.status} />
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
              <KV label="מזהה" value={selected.id} dir="ltr" />
              <KV label="סוג" value={selected.job_type} />
              <KV
                label="נוצר"
                value={new Date(selected.created_at).toLocaleString("he-IL")}
              />
              <KV
                label="תוזמן ל"
                value={new Date(selected.scheduled_for).toLocaleString("he-IL")}
              />
              <KV label="נסיונות" value={`${selected.attempts} / ${selected.max_attempts}`} />
              {selected.dedup_key && (
                <KV label="Dedup Key" value={selected.dedup_key} dir="ltr" />
              )}
              {selected.last_error && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-bold text-muted-foreground">
                    שגיאה אחרונה
                  </div>
                  <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-destructive text-[11px]">
                    {selected.last_error}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] font-bold text-muted-foreground">Payload</div>
                <JsonViewer value={selected.payload} maxHeight={200} />
              </div>
              {selected.result && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-bold text-muted-foreground">Result</div>
                  <JsonViewer value={selected.result} maxHeight={200} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ChannelsShell>
  )
}

function KV({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold text-muted-foreground min-w-[80px]">
        {label}
      </span>
      <span className="font-mono text-[11px]" dir={dir}>
        {value}
      </span>
    </div>
  )
}

function SelectPill({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-accent/60 border-0 rounded-xl px-4 py-2.5 pe-9 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none min-h-[44px] appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        size="sm"
        className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
    </div>
  )
}
