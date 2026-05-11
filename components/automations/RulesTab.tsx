"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getRules, toggleRule } from "@/lib/actions/automations"
import { CHANNEL_MAP, TRIGGER_TYPE_MAP } from "@/lib/constants/automations"
import { toast } from "sonner"
import type { AutomationRule, RuleFilters, TriggerType } from "@/lib/types/automations"

interface RulesTabProps {
  onCreateNew: () => void
  onSelect: (id: string) => void
}

const TRIGGER_OPTIONS: Array<{ value: TriggerType | "all"; label: string }> = [
  { value: "all", label: "הכל" },
  { value: "event", label: "אירוע" },
  { value: "relative_date", label: "תאריך יחסי" },
  { value: "exact_time", label: "זמן קבוע" },
  { value: "conditional", label: "תנאי" },
]

const ACTIVE_OPTIONS: Array<{ value: boolean | "all"; label: string }> = [
  { value: "all", label: "הכל" },
  { value: true, label: "פעילות" },
  { value: false, label: "מושבתות" },
]

function formatDelay(rule: AutomationRule): string {
  if (rule.send_days_before) return `${rule.send_days_before} ימים לפני`
  if (rule.send_days_after) return `${rule.send_days_after} ימים אחרי`
  if (rule.delay_minutes === 0) return "מיידי"
  if (rule.delay_minutes < 60) return `${rule.delay_minutes} דקות`
  return `${Math.round(rule.delay_minutes / 60)} שעות`
}

export function RulesTab({ onCreateNew, onSelect }: RulesTabProps) {
  const { tenantId } = useTenant()
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<RuleFilters>({ trigger_type: "all", active: "all" })
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRules(tenantId, {
        ...filters,
        search: search || undefined,
      })
      setRules(data)
    } catch {
      toast.error("שגיאה בטעינת אוטומציות")
    } finally {
      setLoading(false)
    }
  }, [tenantId, filters, search])

  useEffect(() => { load() }, [load])

  async function handleToggle(ruleId: string, currentActive: boolean) {
    const res = await toggleRule(tenantId, ruleId, !currentActive)
    if (res.success) {
      toast.success(currentActive ? "אוטומציה הושבתה" : "אוטומציה הופעלה")
      load()
    } else {
      toast.error(res.error ?? "שגיאה")
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
            placeholder="חיפוש אוטומציה..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-accent border-0 rounded-xl pr-11 pl-5 py-3.5 min-h-[48px] text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TRIGGER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilters((f) => ({ ...f, trigger_type: opt.value }))}
              className={`pill-filter ${filters.trigger_type === opt.value ? "pill-filter-active" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ACTIVE_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setFilters((f) => ({ ...f, active: opt.value }))}
              className={`pill-filter ${filters.active === opt.value ? "pill-filter-active" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={onCreateNew}
          className="mr-auto flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-3 min-h-[44px] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Icon name="add" size="sm" />
          אוטומציה חדשה
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#e1e7fa]">
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">שם</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">טריגר</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">תזמון</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">ערוץ</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">תבנית</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">פעיל</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">עדיפות</th>
                <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Icon name="hourglass_empty" className="animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Icon name="bolt" size="xl" className="mx-auto opacity-30 mb-2" />
                    <p>אין אוטומציות להצגה</p>
                  </td>
                </tr>
              ) : (
                rules.map((r, idx) => {
                  const trigger = TRIGGER_TYPE_MAP[r.trigger_type]
                  const primaryChannel = r.channel_priority?.[0]
                  const ch = primaryChannel ? CHANNEL_MAP[primaryChannel] : null
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onSelect(r.id)}
                      className={`border-t border-border/10 hover:bg-accent/60 cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-accent/40" : ""}`}
                    >
                      <td className="px-5 py-4 font-medium">{r.name}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 bg-accent rounded-lg px-2.5 py-1 text-xs">
                          <Icon name={trigger.icon} size="sm" className="text-muted-foreground" />
                          {trigger.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{formatDelay(r)}</td>
                      <td className="px-5 py-4">
                        {ch ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs ${ch.color}`}>
                            <Icon name={ch.icon} size="sm" />
                            {ch.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{r.template_name ?? "—"}</td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggle(r.id, r.is_active)}
                          className="p-1 rounded-lg hover:bg-accent transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title={r.is_active ? "השבת" : "הפעל"}
                        >
                          <Icon
                            name={r.is_active ? "toggle_on" : "toggle_off"}
                            size="lg"
                            className={r.is_active ? "text-emerald-500" : "text-slate-400"}
                          />
                        </button>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{r.priority}</td>
                      <td className="px-5 py-4">
                        <button
                          className="p-2 rounded-lg hover:bg-accent transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="ערוך"
                        >
                          <Icon name="edit" size="sm" className="text-muted-foreground" />
                        </button>
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
