"use client"

import { useState } from "react"
import { toast } from "sonner"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass, textareaClass } from "@/components/shared/FormField"
import { SUPPLIER_TYPE_OPTIONS, PAYMENT_TERMS_MAP, PHONE_REGEX, EMAIL_REGEX } from "@/lib/constants/suppliers"
import { createSupplier, getUserFullNameForSuppliers } from "@/lib/actions/suppliers"
import { useTenant } from "@/lib/hooks/use-tenant"
import type { SupplierCreateInput, SupplierPaymentTerms } from "@/lib/types/suppliers"

/* ── Props ─────────────────────────────────────────────────── */

interface CreateSupplierPanelProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

/* ── Initial State ─────────────────────────────────────────── */

const INITIAL_FORM: SupplierCreateInput = {
  display_name: "",
  company_name: "",
  contact_person: "",
  supplier_type: "general",
  phone: "",
  mobile: "",
  email: "",
  address: "",
  city: "",
  website: "",
  tax_id: "",
  notes: "",
  bank_name: "",
  bank_branch: "",
  bank_account: "",
  payment_terms: "net_30",
}

/* ── Component ─────────────────────────────────────────────── */

export function CreateSupplierPanel({ isOpen, onClose, onCreated }: CreateSupplierPanelProps) {
  const { tenantId, userId } = useTenant()
  const [form, setForm] = useState<SupplierCreateInput>({ ...INITIAL_FORM })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function updateField<K extends keyof SupplierCreateInput>(key: K, value: SupplierCreateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}

    if (!form.display_name?.trim()) {
      errs.display_name = "חובה להזין שם תצוגה"
    }
    if (form.phone && !PHONE_REGEX.test(form.phone)) {
      errs.phone = "מספר טלפון לא תקין"
    }
    if (form.mobile && !PHONE_REGEX.test(form.mobile)) {
      errs.mobile = "מספר נייד לא תקין"
    }
    if (form.email && !EMAIL_REGEX.test(form.email)) {
      errs.email = "כתובת אימייל לא תקינה"
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    setSaving(true)
    const userName = await getUserFullNameForSuppliers(tenantId, userId)
    const result = await createSupplier(tenantId, form, userId, userName)
    setSaving(false)

    if (!result.success) {
      toast.error(result.error ?? "שגיאה ביצירת ספק")
      return
    }

    toast.success("הספק נוצר בהצלחה")
    setForm({ ...INITIAL_FORM })
    setErrors({})
    onCreated()
    onClose()
  }

  function handleClose() {
    setForm({ ...INITIAL_FORM })
    setErrors({})
    onClose()
  }

  const errorRing = "ring-2 ring-red-400"

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="ספק חדש"
      subtitle="יצירת ספק חדש במערכת"
      footer={
        <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-row-reverse">
          <button
            onClick={handleClose}
            disabled={saving}
            className="btn btn-outline"
          >
            ביטול
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? (
              <Icon name="hourglass_empty" size="sm" className="text-primary-foreground animate-spin" />
            ) : (
              <Icon name="add" size="sm" className="text-primary-foreground" />
            )}
            {saving ? "יוצר..." : "צור ספק"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── Section 1: Supplier Details ── */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">פרטי הספק</h3>
          </div>

          <FormField label="שם תצוגה" required error={errors.display_name}>
            <input
              type="text"
              value={form.display_name ?? ""}
              onChange={(e) => updateField("display_name", e.target.value)}
              className={`${inputClass} ${errors.display_name ? errorRing : ""}`}
              placeholder="שם הספק"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="שם חברה">
              <input
                type="text"
                value={form.company_name ?? ""}
                onChange={(e) => updateField("company_name", e.target.value)}
                className={inputClass}
                placeholder="שם החברה (אופציונלי)"
              />
            </FormField>

            <FormField label="סוג ספק">
              <select
                value={form.supplier_type ?? "general"}
                onChange={(e) => updateField("supplier_type", e.target.value)}
                className={selectClass}
              >
                {SUPPLIER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="איש קשר">
            <input
              type="text"
              value={form.contact_person ?? ""}
              onChange={(e) => updateField("contact_person", e.target.value)}
              className={inputClass}
              placeholder="שם איש הקשר"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="טלפון" error={errors.phone}>
              <input
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => updateField("phone", e.target.value)}
                className={`${inputClass} ${errors.phone ? errorRing : ""}`}
                placeholder="03-0000000"
                dir="ltr"
              />
            </FormField>

            <FormField label="נייד" error={errors.mobile}>
              <input
                type="tel"
                value={form.mobile ?? ""}
                onChange={(e) => updateField("mobile", e.target.value)}
                className={`${inputClass} ${errors.mobile ? errorRing : ""}`}
                placeholder="050-0000000"
                dir="ltr"
              />
            </FormField>
          </div>

          <FormField label="אימייל" error={errors.email}>
            <input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => updateField("email", e.target.value)}
              className={`${inputClass} ${errors.email ? errorRing : ""}`}
              placeholder="email@example.com"
              dir="ltr"
            />
          </FormField>
        </div>

        {/* ── Section 2: Address & Additional ── */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">כתובת ופרטים נוספים</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="כתובת">
              <input
                type="text"
                value={form.address ?? ""}
                onChange={(e) => updateField("address", e.target.value)}
                className={inputClass}
                placeholder="רחוב ומספר"
              />
            </FormField>

            <FormField label="עיר">
              <input
                type="text"
                value={form.city ?? ""}
                onChange={(e) => updateField("city", e.target.value)}
                className={inputClass}
                placeholder="עיר"
              />
            </FormField>
          </div>

          <FormField label="אתר אינטרנט">
            <input
              type="url"
              value={form.website ?? ""}
              onChange={(e) => updateField("website", e.target.value)}
              className={inputClass}
              placeholder="https://example.com"
              dir="ltr"
            />
          </FormField>

          <FormField label="ח.פ / ע.מ">
            <input
              type="text"
              value={form.tax_id ?? ""}
              onChange={(e) => updateField("tax_id", e.target.value)}
              className={inputClass}
              placeholder="מספר עוסק מורשה / חברה"
              dir="ltr"
            />
          </FormField>

          <FormField label="הערות">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => updateField("notes", e.target.value)}
              className={textareaClass}
              rows={3}
              placeholder="הערות כלליות..."
            />
          </FormField>
        </div>

        {/* ── Section 3: Payment Terms ── */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">תנאי תשלום</h3>
          </div>

          <FormField label="תנאי תשלום">
            <select
              value={form.payment_terms ?? "net_30"}
              onChange={(e) => updateField("payment_terms", e.target.value as SupplierPaymentTerms)}
              className={selectClass}
            >
              {Object.entries(PAYMENT_TERMS_MAP).map(([value, cfg]) => (
                <option key={value} value={value}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="שם בנק">
              <input
                type="text"
                value={form.bank_name ?? ""}
                onChange={(e) => updateField("bank_name", e.target.value)}
                className={inputClass}
                placeholder="שם הבנק"
              />
            </FormField>

            <FormField label="סניף">
              <input
                type="text"
                value={form.bank_branch ?? ""}
                onChange={(e) => updateField("bank_branch", e.target.value)}
                className={inputClass}
                placeholder="מספר סניף"
                dir="ltr"
              />
            </FormField>

            <FormField label="מספר חשבון">
              <input
                type="text"
                value={form.bank_account ?? ""}
                onChange={(e) => updateField("bank_account", e.target.value)}
                className={inputClass}
                placeholder="מספר חשבון"
                dir="ltr"
              />
            </FormField>
          </div>
        </div>
      </div>
    </SidePanel>
  )
}
