"use client"

import { useEffect, useState, useCallback } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { toast } from "sonner"
import { getTemplate, updateTemplate } from "@/lib/actions/automations"
import { CATEGORY_MAP, CHANNEL_MAP } from "@/lib/constants/automations"
import { useTenant } from "@/lib/hooks/use-tenant"
import { sanitizeHtml } from "@/lib/utils/sanitize-html"
import type { AutomationTemplate, TemplateCategory, ChannelType } from "@/lib/types/automations"

interface TemplateDetailPanelProps {
  templateId: string | null
  onClose: () => void
  onUpdated: () => void
}

const inputClass = "w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm min-h-[48px] outline-none focus:ring-2 focus:ring-primary/20"
const selectClass = `${inputClass} pe-10 appearance-none cursor-pointer select-arrow`
const labelClass = "block text-xs font-bold text-muted-foreground mb-1.5"

export function TemplateDetailPanel({ templateId, onClose, onUpdated }: TemplateDetailPanelProps) {
  const { tenantId, userId } = useTenant()
  const isOpen = templateId !== null

  const [template, setTemplate] = useState<AutomationTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Edit form state
  const [name, setName] = useState("")
  const [category, setCategory] = useState<TemplateCategory>("system")
  const [channelType, setChannelType] = useState<ChannelType>("email")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [description, setDescription] = useState("")
  const [notesInternal, setNotesInternal] = useState("")
  const [isActive, setIsActive] = useState(true)

  const loadTemplate = useCallback(async () => {
    if (!templateId) return
    setLoading(true)
    const data = await getTemplate(tenantId, templateId)
    setTemplate(data)
    if (data) {
      setName(data.name)
      setCategory(data.category)
      setChannelType(data.channel_type)
      setSubject(data.subject)
      setBody(data.body)
      setDescription(data.description)
      setNotesInternal(data.notes_internal)
      setIsActive(data.is_active)
    }
    setLoading(false)
  }, [templateId, tenantId])

  useEffect(() => {
    if (isOpen) {
      loadTemplate()
      setIsEditing(false)
      setShowPreview(false)
    }
  }, [isOpen, loadTemplate])

  async function handleSave() {
    if (!template) return
    setSaving(true)
    const result = await updateTemplate(tenantId, template.id, {
      name, category, channel_type: channelType, subject, body, description, notes_internal: notesInternal, is_active: isActive,
    }, userId)
    setSaving(false)
    if (result.success) {
      toast.success("התבנית עודכנה")
      setIsEditing(false)
      loadTemplate()
      onUpdated()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  async function handleToggleActive() {
    if (!template) return
    const result = await updateTemplate(tenantId, template.id, { is_active: !template.is_active }, userId)
    if (result.success) {
      toast.success(template.is_active ? "התבנית הושבתה" : "התבנית הופעלה")
      loadTemplate()
      onUpdated()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  async function handleTestSend() {
    toast.success("שליחת בדיקה — יתווסף בשלב הבא")
  }

  const isEmail = (isEditing ? channelType : template?.channel_type) === "email"

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={template?.name ?? "תבנית"}
      subtitle={template ? `${CATEGORY_MAP[template.category]?.label} · ${CHANNEL_MAP[template.channel_type]?.label}` : ""}
      footer={
        template ? (
          <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-row-reverse">
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className="btn btn-outline">
                  ביטול
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="check" size="sm" />}
                  שמור
                </button>
              </>
            ) : (
              <>
                <div />
                <div className="flex items-center gap-2">
                  <button onClick={handleTestSend} className="pill-filter">
                    <Icon name="send" size="sm" />
                    שלח בדיקה
                  </button>
                  <button onClick={handleToggleActive} className="pill-filter">
                    <Icon name={template.is_active ? "pause" : "play_arrow"} size="sm" />
                    {template.is_active ? "השבת" : "הפעל"}
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    disabled={template.is_system_locked && !template.allow_super_admin_edit}
                    className="pill-filter pill-filter-active"
                  >
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
      ) : !template ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="description" size="xl" className="opacity-30" />
          <p className="text-sm">תבנית לא נמצאה</p>
        </div>
      ) : isEditing ? (
        /* ── Edit Mode ────────────────────────────────────── */
        <div className="space-y-5">
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h3 className="text-base font-bold text-foreground">פרטי התבנית</h3>
            </div>
            <div>
              <label className={labelClass}>שם</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>קטגוריה</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)} className={selectClass}>
                  {Object.entries(CATEGORY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>ערוץ</label>
                <select value={channelType} onChange={(e) => setChannelType(e.target.value as ChannelType)} className={selectClass}>
                  {Object.entries(CHANNEL_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>תיאור</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-accent">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="tpl-active" className="w-5 h-5 rounded" />
              <label htmlFor="tpl-active" className="text-sm font-medium cursor-pointer">תבנית פעילה</label>
            </div>
          </div>

          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h3 className="text-base font-bold text-foreground">תוכן</h3>
            </div>
            {isEmail && (
              <div>
                <label className={labelClass}>נושא</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
              </div>
            )}
            <div>
              <label className={labelClass}>גוף ההודעה</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={isEmail ? 14 : 6}
                className={`${inputClass} resize-none font-mono text-[13px] leading-relaxed`}
                dir={isEmail ? "ltr" : "rtl"}
              />
            </div>
          </div>

          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <h3 className="text-base font-bold text-foreground">הערות פנימיות</h3>
            </div>
            <textarea value={notesInternal} onChange={(e) => setNotesInternal(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>
        </div>
      ) : (
        /* ── View Mode ────────────────────────────────────── */
        <div className="space-y-5">
          {/* Toggle preview / details — Azure Ethos Subtle Card (Variation 3) */}
          <div className="flex justify-end">
            <div className="inline-flex bg-[#f4f2fc] p-1 rounded-xl flex-wrap" dir="rtl">
              <button
                onClick={() => setShowPreview(false)}
                aria-pressed={!showPreview}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                  !showPreview
                    ? "bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                    : "text-[#474747] hover:text-[#1e40af] font-medium"
                }`}
              >
                <Icon name="info" size="sm" />
                פרטים
              </button>
              <button
                onClick={() => setShowPreview(true)}
                aria-pressed={showPreview}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                  showPreview
                    ? "bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                    : "text-[#474747] hover:text-[#1e40af] font-medium"
                }`}
              >
                <Icon name="visibility" size="sm" />
                תצוגה מקדימה
              </button>
            </div>
          </div>

          {showPreview ? (
            <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
              {isEmail && (
                <div className="mb-4 p-3 bg-accent rounded-xl">
                  <span className="text-xs font-bold text-muted-foreground">נושא: </span>
                  <span className="text-sm font-bold">{template.subject || "(ללא)"}</span>
                </div>
              )}
              <div
                className="bg-white dark:bg-card border border-border/30 rounded-xl p-6 text-sm leading-relaxed min-h-[200px]"
                dir="rtl"
                dangerouslySetInnerHTML={{
                  __html: template.body
                    ? sanitizeHtml(template.body)
                    : "<p style=\"color:#999\">גוף ריק</p>",
                }}
              />
            </div>
          ) : (
            <>
              {/* Info grid */}
              <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-accent rounded-xl p-3">
                    <div className="text-[11px] text-muted-foreground mb-0.5">שם</div>
                    <div className="text-sm font-bold">{template.name}</div>
                  </div>
                  <div className="bg-accent rounded-xl p-3">
                    <div className="text-[11px] text-muted-foreground mb-0.5">מפתח</div>
                    <div className="text-sm font-bold font-mono" dir="ltr">{template.key}</div>
                  </div>
                  <div className="bg-accent rounded-xl p-3">
                    <div className="text-[11px] text-muted-foreground mb-0.5">קטגוריה</div>
                    <div className="text-sm font-bold">{CATEGORY_MAP[template.category]?.label}</div>
                  </div>
                  <div className="bg-accent rounded-xl p-3">
                    <div className="text-[11px] text-muted-foreground mb-0.5">ערוץ</div>
                    <div className="text-sm font-bold">{CHANNEL_MAP[template.channel_type]?.label}</div>
                  </div>
                  <div className="bg-accent rounded-xl p-3">
                    <div className="text-[11px] text-muted-foreground mb-0.5">סטטוס</div>
                    <div className={`text-sm font-bold ${template.is_active ? "text-emerald-600" : "text-slate-500"}`}>
                      {template.is_active ? "פעילה" : "מושבתת"}
                    </div>
                  </div>
                  <div className="bg-accent rounded-xl p-3">
                    <div className="text-[11px] text-muted-foreground mb-0.5">נעולה</div>
                    <div className="text-sm font-bold">{template.is_system_locked ? "כן" : "לא"}</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {template.description && (
                <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
                  <h4 className="text-sm font-bold text-foreground mb-2">תיאור</h4>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </div>
              )}

              {/* Internal notes */}
              {template.notes_internal && (
                <div className="bg-card rounded-[20px] p-5 shadow-sm border border-amber-200/50">
                  <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                    <Icon name="sticky_note_2" size="sm" />
                    הערות פנימיות
                  </h4>
                  <p className="text-sm text-muted-foreground">{template.notes_internal}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </SidePanel>
  )
}
