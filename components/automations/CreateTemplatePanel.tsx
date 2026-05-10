"use client"

import { useState } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { toast } from "sonner"
import { createTemplate } from "@/lib/actions/automations"
import { CATEGORY_MAP, CHANNEL_MAP } from "@/lib/constants/automations"
import { sanitizeHtml } from "@/lib/utils/sanitize-html"
import { useTenant } from "@/lib/hooks/use-tenant"
import type { TemplateCreateInput, TemplateCategory, ChannelType } from "@/lib/types/automations"

interface CreateTemplatePanelProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

const inputClass = "w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm min-h-[48px] outline-none focus:ring-2 focus:ring-primary/20"
const selectClass = `${inputClass} pe-10 appearance-none cursor-pointer select-arrow`
const labelClass = "block text-xs font-bold text-muted-foreground mb-1.5"

const INITIAL: TemplateCreateInput = {
  key: "",
  name: "",
  category: "system",
  channel_type: "email",
  subject: "",
  body: "",
  description: "",
  notes_internal: "",
  available_variables: [],
}

export function CreateTemplatePanel({ isOpen, onClose, onCreated }: CreateTemplatePanelProps) {
  const { tenantId, userId } = useTenant()
  const [form, setForm] = useState<TemplateCreateInput>({ ...INITIAL })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPreview, setShowPreview] = useState(false)

  function update<K extends keyof TemplateCreateInput>(key: K, val: TemplateCreateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n })
  }

  // Auto-generate key from name
  function handleNameChange(name: string) {
    update("name", name)
    if (!form.key || form.key === slugify(form.name)) {
      update("key", slugify(name))
    }
  }

  function slugify(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\u0590-\u05FF]/g, "").slice(0, 50)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.name?.trim()) errs.name = "חובה"
    if (!form.key?.trim()) errs.key = "חובה"
    if (form.channel_type === "email" && !form.subject?.trim()) errs.subject = "חובה להזין נושא לאימייל"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    const result = await createTemplate(tenantId, form, userId)
    setSaving(false)
    if (result.success) {
      toast.success("התבנית נוצרה בהצלחה")
      setForm({ ...INITIAL })
      setErrors({})
      onCreated()
      onClose()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  const isEmail = form.channel_type === "email"

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="תבנית הודעה חדשה"
      subtitle="יצירת תבנית לשליחה אוטומטית"
      footer={
        <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-row-reverse">
          <button onClick={onClose} className="btn btn-outline">
            ביטול
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="pill-filter"
            >
              <Icon name="visibility" size="sm" />
              {showPreview ? "עריכה" : "תצוגה מקדימה"}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="add" size="sm" />}
              צור תבנית
            </button>
          </div>
        </div>
      }
    >
      {showPreview ? (
        /* ── Preview Mode ─────────────────────────────────── */
        <div className="space-y-5">
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="text-base font-bold text-foreground">תצוגה מקדימה</h3>
            </div>

            {isEmail && (
              <div className="mb-4 p-3 bg-accent rounded-xl">
                <span className="text-xs font-bold text-muted-foreground">נושא: </span>
                <span className="text-sm font-bold">{form.subject || "(ללא נושא)"}</span>
              </div>
            )}

            <div
              className="bg-white dark:bg-card border border-border/30 rounded-xl p-6 text-sm leading-relaxed min-h-[200px]"
              dir="rtl"
              dangerouslySetInnerHTML={{
                __html: form.body
                  ? sanitizeHtml(form.body)
                  : "<p style=\"color:#999\">גוף ההודעה ריק</p>",
              }}
            />
          </div>

          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h3 className="text-base font-bold text-foreground">פרטי תבנית</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-accent rounded-xl p-3">
                <div className="text-[11px] text-muted-foreground mb-0.5">שם</div>
                <div className="text-sm font-bold">{form.name || "—"}</div>
              </div>
              <div className="bg-accent rounded-xl p-3">
                <div className="text-[11px] text-muted-foreground mb-0.5">מפתח</div>
                <div className="text-sm font-bold font-mono" dir="ltr">{form.key || "—"}</div>
              </div>
              <div className="bg-accent rounded-xl p-3">
                <div className="text-[11px] text-muted-foreground mb-0.5">קטגוריה</div>
                <div className="text-sm font-bold">{CATEGORY_MAP[form.category]?.label}</div>
              </div>
              <div className="bg-accent rounded-xl p-3">
                <div className="text-[11px] text-muted-foreground mb-0.5">ערוץ</div>
                <div className="text-sm font-bold">{CHANNEL_MAP[form.channel_type]?.label}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Edit Mode ────────────────────────────────────── */
        <div className="space-y-5">
          {/* Section 1: Details */}
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h3 className="text-base font-bold text-foreground">פרטי התבנית</h3>
            </div>

            <div>
              <label className={labelClass}>שם התבנית *</label>
              <input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="לדוגמה: אישור הזמנה"
                className={`${inputClass} ${errors.name ? "ring-2 ring-red-400" : ""}`}
              />
              {errors.name && <p className="text-[11px] text-destructive mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className={labelClass}>מפתח (key) *</label>
              <input
                value={form.key}
                onChange={(e) => update("key", e.target.value)}
                placeholder="reservation_confirmed"
                dir="ltr"
                className={`${inputClass} font-mono ${errors.key ? "ring-2 ring-red-400" : ""}`}
              />
              {errors.key && <p className="text-[11px] text-destructive mt-1">{errors.key}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>קטגוריה</label>
                <select value={form.category} onChange={(e) => update("category", e.target.value as TemplateCategory)} className={selectClass}>
                  {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>ערוץ שליחה</label>
                <select value={form.channel_type} onChange={(e) => update("channel_type", e.target.value as ChannelType)} className={selectClass}>
                  {Object.entries(CHANNEL_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>תיאור</label>
              <input
                value={form.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
                placeholder="תיאור קצר של התבנית..."
                className={inputClass}
              />
            </div>
          </div>

          {/* Section 2: Content */}
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <h3 className="text-base font-bold text-foreground">תוכן ההודעה</h3>
            </div>

            {isEmail && (
              <div>
                <label className={labelClass}>נושא (Subject) *</label>
                <input
                  value={form.subject ?? ""}
                  onChange={(e) => update("subject", e.target.value)}
                  placeholder="אישור הזמנה #{{reservation_number}}"
                  className={`${inputClass} ${errors.subject ? "ring-2 ring-red-400" : ""}`}
                />
                {errors.subject && <p className="text-[11px] text-destructive mt-1">{errors.subject}</p>}
              </div>
            )}

            <div>
              <label className={labelClass}>גוף ההודעה {isEmail ? "(HTML)" : ""}</label>
              <textarea
                value={form.body ?? ""}
                onChange={(e) => update("body", e.target.value)}
                placeholder={isEmail ? "<p>שלום {{full_name}},</p>\n<p>ההזמנה שלך אושרה.</p>" : "שלום {{full_name}}, ההזמנה שלך אושרה."}
                rows={isEmail ? 12 : 5}
                className={`${inputClass} resize-none font-mono text-[13px] leading-relaxed`}
                dir={isEmail ? "ltr" : "rtl"}
              />
            </div>

            {/* Variable hints */}
            <div className="p-3 bg-accent/50 rounded-xl">
              <p className="text-[11px] font-bold text-muted-foreground mb-2">משתנים זמינים — לחץ להעתקה:</p>
              <div className="flex flex-wrap gap-1.5">
                {["full_name", "business_name", "reservation_number", "check_in_date", "check_out_date", "room_number", "total_price", "support_phone"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`{{${v}}}`)
                      toast.success(`{{${v}}} הועתק`)
                    }}
                    className="px-2 py-1 rounded-lg bg-card border border-border/20 text-[11px] font-mono text-primary hover:bg-primary/5 transition-colors"
                    dir="ltr"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Notes */}
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <h3 className="text-base font-bold text-foreground">הערות פנימיות</h3>
            </div>
            <textarea
              value={form.notes_internal ?? ""}
              onChange={(e) => update("notes_internal", e.target.value)}
              placeholder="הערות פנימיות (לא מוצגות למשתמש)..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      )}
    </SidePanel>
  )
}
