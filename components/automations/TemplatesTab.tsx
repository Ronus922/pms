"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getTemplates, deleteTemplate, duplicateTemplate } from "@/lib/actions/automations"
import { CHANNEL_MAP, CATEGORY_MAP } from "@/lib/constants/automations"
import { toast } from "sonner"
import type { AutomationTemplate, TemplateFilters, TemplateCategory, ChannelType } from "@/lib/types/automations"

interface TemplatesTabProps {
  onCreateNew: () => void
  onSelect: (id: string) => void
}

function fmtDate(v: string | null): string {
  if (!v) return "—"
  const d = new Date(v)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

const CATEGORY_OPTIONS: Array<{ value: TemplateCategory | "all"; label: string }> = [
  { value: "all", label: "הכל" },
  { value: "registration", label: "הרשמה" },
  { value: "reservations", label: "הזמנות" },
  { value: "tasks", label: "משימות" },
  { value: "cleaning", label: "ניקיון" },
  { value: "maintenance", label: "תחזוקה" },
  { value: "attendance", label: "נוכחות" },
  { value: "suppliers", label: "ספקים" },
  { value: "system", label: "מערכת" },
]

const CHANNEL_OPTIONS: Array<{ value: ChannelType | "all"; label: string }> = [
  { value: "all", label: "הכל" },
  { value: "email", label: "אימייל" },
  { value: "whatsapp", label: "וואטסאפ" },
  { value: "sms", label: "SMS" },
  { value: "in_app", label: "התראה פנימית" },
  { value: "push_notification", label: "פוש" },
]

export function TemplatesTab({ onCreateNew, onSelect }: TemplatesTabProps) {
  const { tenantId, userId } = useTenant()
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<TemplateFilters>({ category: "all", channel: "all" })
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getTemplates(tenantId, { ...filters, search: search || undefined })
      setTemplates(data)
    } catch {
      toast.error("שגיאה בטעינת תבניות")
    } finally {
      setLoading(false)
    }
  }, [tenantId, filters, search])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    const res = await deleteTemplate(tenantId, id)
    if (res.success) {
      toast.success("תבנית נמחקה")
      load()
    } else {
      toast.error(res.error ?? "שגיאה במחיקה")
    }
  }

  async function handleDuplicate(id: string) {
    const res = await duplicateTemplate(tenantId, id, userId)
    if (res.success) {
      toast.success("תבנית שוכפלה")
      load()
    } else {
      toast.error(res.error ?? "שגיאה בשכפול")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-[360px]">
          <Icon name="search" size="sm" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="חיפוש תבנית..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-accent border-0 rounded-xl pr-11 pl-5 py-3.5 min-h-[48px] text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilters((f) => ({ ...f, category: opt.value }))}
              className={`pill-filter ${filters.category === opt.value ? "pill-filter-active" : ""}`}
            >
              {opt.label}
            </button>
          ))}
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

        <button
          onClick={onCreateNew}
          className="ms-auto flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-3 min-h-[44px] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Icon name="add" size="sm" />
          תבנית חדשה
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary/10">
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">שם</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">קטגוריה</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">ערוץ</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">פעיל</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">עודכן</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Icon name="hourglass_empty" className="animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Icon name="description" size="xl" className="mx-auto opacity-30 mb-2" />
                    <p>אין תבניות להצגה</p>
                  </td>
                </tr>
              ) : (
                templates.map((t, idx) => {
                  const cat = CATEGORY_MAP[t.category]
                  const ch = CHANNEL_MAP[t.channel_type]
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onSelect(t.id)}
                      className={`border-t border-border/10 hover:bg-accent/60 cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-accent/40" : ""}`}
                    >
                      <td className="px-5 py-4 font-medium">{t.name}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 bg-accent rounded-lg px-2.5 py-1 text-xs">
                          <Icon name={cat.icon} size="sm" className="text-muted-foreground" />
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs ${ch.color}`}>
                          <Icon name={ch.icon} size="sm" />
                          {ch.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${t.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                      </td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">{fmtDate(t.updated_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(t.id) }}
                            className="p-2 rounded-lg hover:bg-accent transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="שכפל"
                          >
                            <Icon name="copy" size="sm" className="text-muted-foreground" />
                          </button>
                          {!t.is_system_locked && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="מחק"
                            >
                              <Icon name="delete" size="sm" className="text-red-500" />
                            </button>
                          )}
                        </div>
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
