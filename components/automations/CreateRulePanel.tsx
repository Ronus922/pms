"use client"

import { useState, useEffect } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { TimeInput } from "@/components/shared/TimeInput"
import { toast } from "sonner"
import { createRule, getTemplates } from "@/lib/actions/automations"
import { TRIGGER_TYPE_MAP, CHANNEL_MAP, TRIGGER_ENTITY_OPTIONS } from "@/lib/constants/automations"
import { useTenant } from "@/lib/hooks/use-tenant"
import type { RuleCreateInput, TriggerType, ChannelType, AutomationTemplate } from "@/lib/types/automations"

interface CreateRulePanelProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

const inputClass = "w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm min-h-[48px] outline-none focus:ring-2 focus:ring-primary/20"
const selectClass = `${inputClass} pe-10 appearance-none cursor-pointer select-arrow`
const labelClass = "block text-xs font-bold text-muted-foreground mb-1.5"

export function CreateRulePanel({ isOpen, onClose, onCreated }: CreateRulePanelProps) {
  const { tenantId } = useTenant()
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const [description, setDescription] = useState("")
  const [triggerType, setTriggerType] = useState<TriggerType>("event")
  const [triggerEntity, setTriggerEntity] = useState("")
  const [delayMinutes, setDelayMinutes] = useState(0)
  const [sendDaysBefore, setSendDaysBefore] = useState("")
  const [sendDaysAfter, setSendDaysAfter] = useState("")
  const [sendTime, setSendTime] = useState("")
  const [priority, setPriority] = useState(50)
  const [channelPriority, setChannelPriority] = useState<ChannelType[]>(["email"])
  const [templateId, setTemplateId] = useState("")
  const [stopWhen, setStopWhen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    getTemplates(tenantId, { active: true }).then(setTemplates)
  }, [isOpen, tenantId])

  function handleNameChange(val: string) {
    setName(val)
    if (!key || key === slugify(name)) setKey(slugify(val))
  }

  function slugify(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\u0590-\u05FF]/g, "").slice(0, 50)
  }

  function toggleChannel(ch: ChannelType) {
    setChannelPriority((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = "חובה"
    if (!key.trim()) errs.key = "חובה"
    if (!triggerEntity) errs.triggerEntity = "חובה לבחור ישות"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    const data: RuleCreateInput = {
      key: key.trim(),
      name: name.trim(),
      description: description.trim(),
      trigger_type: triggerType,
      trigger_entity: triggerEntity,
      delay_minutes: delayMinutes,
      send_days_before: sendDaysBefore ? Number(sendDaysBefore) : undefined,
      send_days_after: sendDaysAfter ? Number(sendDaysAfter) : undefined,
      send_time: sendTime || undefined,
      priority,
      channel_priority: channelPriority.length > 0 ? channelPriority : ["email"],
      template_id: templateId || undefined,
      stop_when_condition_met: stopWhen,
    }
    const result = await createRule(tenantId, data)
    setSaving(false)
    if (result.success) {
      toast.success("האוטומציה נוצרה בהצלחה")
      resetForm()
      onCreated()
      onClose()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  function resetForm() {
    setName(""); setKey(""); setDescription(""); setTriggerType("event")
    setTriggerEntity(""); setDelayMinutes(0); setSendDaysBefore(""); setSendDaysAfter("")
    setSendTime(""); setPriority(50); setChannelPriority(["email"]); setTemplateId("")
    setStopWhen(false); setErrors({})
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="אוטומציה חדשה"
      subtitle="הגדרת כלל שליחה אוטומטי"
      footer={
        <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-row-reverse">
          <button onClick={onClose} className="btn btn-outline">ביטול</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="add" size="sm" />}
            צור אוטומציה
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Section 1: Basic */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">פרטי האוטומציה</h3>
          </div>
          <div>
            <label className={labelClass}>שם *</label>
            <input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="לדוגמה: תזכורת צ׳ק-אין" className={`${inputClass} ${errors.name ? "ring-2 ring-red-400" : ""}`} />
          </div>
          <div>
            <label className={labelClass}>מפתח *</label>
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="checkin_reminder" dir="ltr" className={`${inputClass} font-mono ${errors.key ? "ring-2 ring-red-400" : ""}`} />
          </div>
          <div>
            <label className={labelClass}>תיאור</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור קצר..." className={inputClass} />
          </div>
        </div>

        {/* Section 2: Trigger */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">טריגר ותזמון</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>סוג טריגר</label>
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as TriggerType)} className={selectClass}>
                {Object.entries(TRIGGER_TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>ישות *</label>
              <select value={triggerEntity} onChange={(e) => setTriggerEntity(e.target.value)} className={`${selectClass} ${errors.triggerEntity ? "ring-2 ring-red-400" : ""}`}>
                <option value="">בחר ישות</option>
                {TRIGGER_ENTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Timing hint */}
          <div className="p-3 bg-accent/50 rounded-xl text-[11px] text-muted-foreground">
            <Icon name="info" size="sm" className="inline ml-1" />
            {TRIGGER_TYPE_MAP[triggerType].description}
          </div>

          {triggerType === "relative_date" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>ימים לפני</label>
                <input type="number" value={sendDaysBefore} onChange={(e) => setSendDaysBefore(e.target.value)} min={0} className={inputClass} placeholder="0" />
              </div>
              <div>
                <label className={labelClass}>ימים אחרי</label>
                <input type="number" value={sendDaysAfter} onChange={(e) => setSendDaysAfter(e.target.value)} min={0} className={inputClass} placeholder="0" />
              </div>
            </div>
          )}

          {triggerType === "exact_time" && (
            <div>
              <label className={labelClass}>שעת שליחה</label>
              <TimeInput value={sendTime} onChange={setSendTime} />
            </div>
          )}

          {triggerType === "event" && (
            <div>
              <label className={labelClass}>השהייה (דקות)</label>
              <input type="number" value={delayMinutes} onChange={(e) => setDelayMinutes(Number(e.target.value))} min={0} className={inputClass} placeholder="0 = מיידי" />
            </div>
          )}

          <div className="flex items-center gap-3 p-3 rounded-xl bg-accent">
            <input type="checkbox" checked={stopWhen} onChange={(e) => setStopWhen(e.target.checked)} id="stop-when" className="w-5 h-5 rounded" />
            <label htmlFor="stop-when" className="text-sm font-medium cursor-pointer">עצור כשהתנאי מתקיים</label>
          </div>
        </div>

        {/* Section 3: Channel + Template */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">ערוץ ותבנית</h3>
          </div>

          <div>
            <label className={labelClass}>ערוצי שליחה (לפי עדיפות)</label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(CHANNEL_MAP) as [ChannelType, { label: string; icon: string }][]).map(([ch, cfg]) => {
                const active = channelPriority.includes(ch)
                const idx = channelPriority.indexOf(ch)
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggleChannel(ch)}
                    className={`pill-filter ${active ? "pill-filter-active" : ""}`}
                  >
                    {active && <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>}
                    <Icon name={cfg.icon} size="sm" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={labelClass}>תבנית הודעה</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={selectClass}>
              <option value="">בחר תבנית</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({CHANNEL_MAP[t.channel_type]?.label})</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>עדיפות</label>
            <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} min={1} max={100} className={inputClass} />
            <p className="text-[11px] text-muted-foreground mt-1">1 = הכי גבוהה, 100 = הכי נמוכה</p>
          </div>
        </div>
      </div>
    </SidePanel>
  )
}
