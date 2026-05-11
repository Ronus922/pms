"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getQueueItems, cancelQueueItem } from "@/lib/actions/automations"
import { CHANNEL_MAP, QUEUE_STATUS_MAP } from "@/lib/constants/automations"
import { toast } from "sonner"
import type { MessageQueueItem, QueueStatus } from "@/lib/types/automations"

const STATUS_FILTERS: Array<{ value: QueueStatus | "all"; label: string }> = [
  { value: "all", label: "הכל" },
  { value: "pending", label: "ממתין" },
  { value: "scheduled", label: "מתוזמן" },
  { value: "sent", label: "נשלח" },
  { value: "failed", label: "נכשל" },
  { value: "cancelled", label: "בוטל" },
]

function fmtDateTime(v: string | null): string {
  if (!v) return "—"
  const d = new Date(v)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function QueueTab() {
  const { tenantId } = useTenant()
  const [items, setItems] = useState<MessageQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<QueueStatus | "all">("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getQueueItems(tenantId, statusFilter === "all" ? "all" : statusFilter)
      setItems(data)
    } catch {
      toast.error("שגיאה בטעינת תור הודעות")
    } finally {
      setLoading(false)
    }
  }, [tenantId, statusFilter])

  useEffect(() => { load() }, [load])

  async function handleCancel(queueId: string) {
    const res = await cancelQueueItem(tenantId, queueId)
    if (res.success) {
      toast.success("הודעה בוטלה")
      load()
    } else {
      toast.error(res.error ?? "שגיאה בביטול")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`pill-filter ${statusFilter === opt.value ? "pill-filter-active" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#e1e7fa]">
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">נמען</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">ערוץ</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">תבנית</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">תאריך</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">סטטוס</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">ניסיונות</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Icon name="hourglass_empty" className="animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Icon name="send" size="xl" className="mx-auto opacity-30 mb-2" />
                    <p>אין הודעות בתור</p>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const ch = CHANNEL_MAP[item.channel_type]
                  const status = QUEUE_STATUS_MAP[item.delivery_status as QueueStatus]
                  const canCancel = item.delivery_status === "pending" || item.delivery_status === "scheduled"
                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-border/10 transition-colors ${idx % 2 === 1 ? "bg-accent/40" : ""}`}
                    >
                      <td className="px-5 py-4 font-medium">{item.recipient_name || item.recipient_email || item.recipient_phone || "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs ${ch.color}`}>
                          <Icon name={ch.icon} size="sm" />
                          {ch.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{item.template_name ?? "—"}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{fmtDateTime(item.scheduled_for)}</td>
                      <td className="px-5 py-4">
                        {status ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${status.bg} ${status.text}`}>
                            {status.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{item.delivery_status}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{item.retry_count}</td>
                      <td className="px-5 py-4">
                        {canCancel && (
                          <button
                            onClick={() => handleCancel(item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors min-h-[44px]"
                          >
                            <Icon name="close" size="sm" />
                            בטל
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
