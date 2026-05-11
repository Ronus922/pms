"use client"

import { useEffect, useState, useCallback } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { TimeInput } from "@/components/shared/TimeInput"
import { toast } from "sonner"
import { getRule, updateRule, toggleRule, getTemplates } from "@/lib/actions/automations"
import { TRIGGER_TYPE_MAP, CHANNEL_MAP, TRIGGER_ENTITY_OPTIONS } from "@/lib/constants/automations"
import { useTenant } from "@/lib/hooks/use-tenant"
import type { AutomationRule, AutomationTemplate, TriggerType, ChannelType } from "@/lib/types/automations"

interface RuleDetailPanelProps {
  ruleId: string | null
  onClose: () => void
  onUpdated: () => void
}

const inputClass = "w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm min-h-[48px] outline-none focus:ring-2 focus:ring-primary/20"
const selectClass = `${inputClass} pe-10 appearance-none cursor-pointer select-arrow`
const labelClass = "block text-xs font-bold text-muted-foreground mb-1.5"

function formatDelay(r: AutomationRule): string {
  if (r.send_days_before) return `${r.send_days_before} ימים לפני`
  if (r.send_days_after) return `${r.send_days_after} ימים אחרי`
  if (r.delay_minutes === 0) return "מיידי"
  if (r.delay_minutes < 60) return `${r.delay_minutes} דקות`
  return `${Math.round(r.delay_minutes / 60)} שעות`
}

export function RuleDetailPanel({ ruleId, onClose, onUpdated }: RuleDetailPanelProps) {
  const { tenantId } = useTenant()
  const isOpen = ruleId !== null

  const [rule, setRule] = useState<AutomationRule | null>(null)
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerType, setTriggerType] = useState<TriggerType>("event")
  const [triggerEntity, setTriggerEntity] = useState("")
  const [delayMinutes, setDelayMinutes] = useState(0)
  const [sendDaysBefore, setSendDaysBefore] = useState("")
  const [sendDaysAfter, setSendDaysAfter] = useState("")
  const [sendTime, setSendTime] = useState("")
  const [priorityVal, setPriorityVal] = useState(50)
  const [channelPriority, setChannelPriority] = useState<ChannelType[]>(["email"])
  const [templateId, setTemplateId] = useState("")

  const loadRule = useCallback(async () => {
    if (!ruleId) return
    setLoading(true)
    const [data, tpls] = await Promise.all([
      getRule(tenantId, ruleId),
      getTemplates(tenantId, { active: true }),
    ])
    setRule(data)
    setTemplates(tpls)
    if (data) {
      setName(data.name); setDescription(data.description)
      setTriggerType(data.trigger_type); setTriggerEntity(data.trigger_entity)
      setDelayMinutes(data.delay_minutes)
      setSendDaysBefore(data.send_days_before?.toString() ?? "")
      setSendDaysAfter(data.send_days_after?.toString() ?? "")
      setSendTime(data.send_time ?? "")
      setPriorityVal(data.priority)
      setChannelPriority(data.channel_priority ?? ["email"])
      setTemplateId(data.template_id ?? "")
    }
    setLoading(false)
  }, [ruleId, tenantId])

  useEffect(() => {
    if (isOpen) { loadRule(); setIsEditing(false) }
  }, [isOpen, loadRule])

  async function handleSave() {
    if (!rule) return
    setSaving(true)
    const result = await updateRule(tenantId, rule.id, {
      name, description, trigger_type: triggerType, trigger_entity: triggerEntity,
      delay_minutes: delayMinutes,
      send_days_before: sendDaysBefore ? Number(sendDaysBefore) : undefined,
      send_days_after: sendDaysAfter ? Number(sendDaysAfter) : undefined,
      send_time: sendTime || undefined, priority: priorityVal,
      channel_priority: channelPriority, template_id: templateId || undefined,
    })
    setSaving(false)
    if (result.success) {
      toast.success("האוטומציה עודכנה")
      setIsEditing(false); loadRule(); onUpdated()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  async function handleToggle() {
    if (!rule) return
    const result = await toggleRule(tenantId, rule.id, !rule.is_active)
    if (result.success) {
      toast.success(rule.is_active ? "הושבתה" : "הופעלה")
      loadRule(); onUpdated()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  function toggleChannel(ch: ChannelType) {
    setChannelPriority((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch])
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={rule?.name ?? "אוטומציה"}
      subtitle={rule ? TRIGGER_TYPE_MAP[rule.trigger_type]?.label : ""}
      footer={
        rule ? (
          <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-row-reverse">
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className="btn btn-outline">ביטול</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="check" size="sm" />}
                  שמור
                </button>
              </>
            ) : (
              <>
                <div />
                <div className="flex items-center gap-2">
                  <button onClick={handleToggle} className="pill-filter">
                    <Icon name={rule.is_active ? "pause" : "play_arrow"} size="sm" />
                    {rule.is_active ? "השבת" : "הפעל"}
                  </button>
                  <button onClick={() => setIsEditing(true)} className="pill-filter pill-filter-active">
                    <Icon name="edit" size="sm" />
                    עריכה
                  </button>
                </div>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !rule ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="bolt" size="xl" className="opacity-30" />
          <p className="text-sm">אוטומציה לא נמצאה</p>
        </div>
      ) : isEditing ? (
        /* ── Edit ──────────────────────────────────────────── */
        <div className="space-y-5">
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-primary" /><h3 className="text-base font-bold">פרטים</h3></div>
            <div><label className={labelClass}>שם</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>תיאור</label><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></div>
          </div>

          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-primary" /><h3 className="text-base font-bold">טריגר</h3></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>סוג</label><select value={triggerType} onChange={(e) => setTriggerType(e.target.value as TriggerType)} className={selectClass}>{Object.entries(TRIGGER_TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label className={labelClass}>ישות</label><select value={triggerEntity} onChange={(e) => setTriggerEntity(e.target.value)} className={selectClass}><option value="">בחר</option>{TRIGGER_ENTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            </div>
            {triggerType === "relative_date" && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>ימים לפני</label><input type="number" value={sendDaysBefore} onChange={(e) => setSendDaysBefore(e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>ימים אחרי</label><input type="number" value={sendDaysAfter} onChange={(e) => setSendDaysAfter(e.target.value)} className={inputClass} /></div>
              </div>
            )}
            {triggerType === "exact_time" && <div><label className={labelClass}>שעה</label><TimeInput value={sendTime} onChange={setSendTime} /></div>}
            {triggerType === "event" && <div><label className={labelClass}>השהייה (דקות)</label><input type="number" value={delayMinutes} onChange={(e) => setDelayMinutes(Number(e.target.value))} className={inputClass} /></div>}
          </div>

          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-primary" /><h3 className="text-base font-bold">ערוץ ותבנית</h3></div>
            <div>
              <label className={labelClass}>ערוצים</label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(CHANNEL_MAP) as [ChannelType, { label: string; icon: string }][]).map(([ch, cfg]) => (
                  <button key={ch} type="button" onClick={() => toggleChannel(ch)} className={`pill-filter ${channelPriority.includes(ch) ? "pill-filter-active" : ""}`}>
                    <Icon name={cfg.icon} size="sm" />{cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div><label className={labelClass}>תבנית</label><select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={selectClass}><option value="">בחר</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className={labelClass}>עדיפות</label><input type="number" value={priorityVal} onChange={(e) => setPriorityVal(Number(e.target.value))} min={1} max={100} className={inputClass} /></div>
          </div>
        </div>
      ) : (
        /* ── View ──────────────────────────────────────────── */
        <div className="space-y-5">
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-accent rounded-xl p-3"><div className="text-[11px] text-muted-foreground mb-0.5">שם</div><div className="text-sm font-bold">{rule.name}</div></div>
              <div className="bg-accent rounded-xl p-3"><div className="text-[11px] text-muted-foreground mb-0.5">מפתח</div><div className="text-sm font-bold font-mono" dir="ltr">{rule.key}</div></div>
              <div className="bg-accent rounded-xl p-3"><div className="text-[11px] text-muted-foreground mb-0.5">טריגר</div><div className="text-sm font-bold">{TRIGGER_TYPE_MAP[rule.trigger_type]?.label}</div></div>
              <div className="bg-accent rounded-xl p-3"><div className="text-[11px] text-muted-foreground mb-0.5">ישות</div><div className="text-sm font-bold">{TRIGGER_ENTITY_OPTIONS.find((o) => o.value === rule.trigger_entity)?.label ?? rule.trigger_entity}</div></div>
              <div className="bg-accent rounded-xl p-3"><div className="text-[11px] text-muted-foreground mb-0.5">תזמון</div><div className="text-sm font-bold">{formatDelay(rule)}</div></div>
              <div className="bg-accent rounded-xl p-3"><div className="text-[11px] text-muted-foreground mb-0.5">עדיפות</div><div className="text-sm font-bold">{rule.priority}</div></div>
              <div className="bg-accent rounded-xl p-3"><div className="text-[11px] text-muted-foreground mb-0.5">סטטוס</div><div className={`text-sm font-bold ${rule.is_active ? "text-emerald-600" : "text-slate-500"}`}>{rule.is_active ? "פעיל" : "מושבת"}</div></div>
              <div className="bg-accent rounded-xl p-3"><div className="text-[11px] text-muted-foreground mb-0.5">תבנית</div><div className="text-sm font-bold">{rule.template_name ?? "—"}</div></div>
            </div>
          </div>

          {/* Channels */}
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
            <h4 className="text-sm font-bold mb-3">ערוצי שליחה (לפי עדיפות)</h4>
            <div className="flex flex-wrap gap-2">
              {rule.channel_priority?.map((ch, i) => {
                const cfg = CHANNEL_MAP[ch]
                return cfg ? (
                  <span key={ch} className="pill-filter pill-filter-active">
                    <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                    <Icon name={cfg.icon} size="sm" />{cfg.label}
                  </span>
                ) : null
              })}
            </div>
          </div>

          {rule.description && (
            <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
              <h4 className="text-sm font-bold mb-2">תיאור</h4>
              <p className="text-sm text-muted-foreground">{rule.description}</p>
            </div>
          )}
        </div>
      )}
    </SidePanel>
  )
}
