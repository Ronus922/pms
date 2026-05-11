"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { DateInput } from "@/components/shared/DateInput"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getMessageLogs } from "@/lib/actions/automations"
import { CHANNEL_MAP } from "@/lib/constants/automations"
import { toast } from "sonner"
import type { MessageLogEntry, LogFilters, ChannelType } from "@/lib/types/automations"

const CHANNEL_OPTIONS: Array<{ value: ChannelType | "all"; label: string }> = [
  { value: "all", label: "הכל" },
  { value: "email", label: "אימייל" },
  { value: "whatsapp", label: "וואטסאפ" },
  { value: "sms", label: "SMS" },
  { value: "in_app", label: "התראה פנימית" },
  { value: "push_notification", label: "פוש" },
]

const STATUS_OPTIONS: Array<{ value: string; label: string; bg: string; text: string }> = [
  { value: "all", label: "הכל", bg: "", text: "" },
  { value: "sent", label: "נשלח", bg: "bg-emerald-50", text: "text-emerald-700" },
  { value: "failed", label: "נכשל", bg: "bg-red-50", text: "text-red-700" },
  { value: "opened", label: "נפתח", bg: "bg-blue-50", text: "text-blue-700" },
  { value: "clicked", label: "נלחץ", bg: "bg-indigo-50", text: "text-indigo-700" },
  { value: "bounced", label: "חזר", bg: "bg-amber-50", text: "text-amber-700" },
]

function fmtDateTime(v: string | null): string {
  if (!v) return "—"
  const d = new Date(v)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function HistoryTab() {
  const { tenantId } = useTenant()
  const [logs, setLogs] = useState<MessageLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LogFilters>({ channel: "all", status: "all" })
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMessageLogs(tenantId, {
        ...filters,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      setLogs(data)
    } catch {
      toast.error("שגיאה בטעינת היסטוריה")
    } finally {
      setLoading(false)
    }
  }, [tenantId, filters, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  function getStatusStyle(status: string): { label: string; bg: string; text: string } {
    const found = STATUS_OPTIONS.find((s) => s.value === status)
    return found ?? { label: status, bg: "bg-slate-100", text: "text-slate-600" }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">מתאריך</label>
          <DateInput value={dateFrom} onChange={setDateFrom} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">עד</label>
          <DateInput value={dateTo} onChange={setDateTo} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CHANNEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilters((f) => ({ ...f, channel: opt.value }))}
              className={`pill-filter ${filters.channel === opt.value ? "pill-filter-active" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilters((f) => ({ ...f, status: opt.value }))}
              className={`pill-filter ${filters.status === opt.value ? "pill-filter-active" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#e1e7fa]">
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">תאריך</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">נמען</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">ערוץ</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">נושא</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">תבנית</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">סטטוס</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 max-lg:hidden">שגיאה</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Icon name="hourglass_empty" className="animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Icon name="history" size="xl" className="mx-auto opacity-30 mb-2" />
                    <p>אין היסטוריית הודעות</p>
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => {
                  const ch = CHANNEL_MAP[log.channel_type]
                  const st = getStatusStyle(log.delivery_status)
                  return (
                    <tr
                      key={log.id}
                      className={`border-t border-border/10 transition-colors ${idx % 2 === 1 ? "bg-accent/40" : ""}`}
                    >
                      <td className="px-5 py-4 text-xs text-muted-foreground">{fmtDateTime(log.sent_at ?? log.created_at)}</td>
                      <td className="px-5 py-4 font-medium text-sm">{log.recipient}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs ${ch.color}`}>
                          <Icon name={ch.icon} size="sm" />
                          {ch.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground max-w-[200px] truncate">{log.subject || "—"}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{log.template_name ?? "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-red-500 max-w-[200px] truncate max-lg:hidden">{log.error_message || "—"}</td>
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
