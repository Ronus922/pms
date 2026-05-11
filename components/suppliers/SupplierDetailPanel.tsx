"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass, textareaClass } from "@/components/shared/FormField"
import { FileViewer } from "@/components/shared/FileViewer"
import {
  SUPPLIER_STATUS_MAP,
  SUPPLIER_TYPE_OPTIONS,
  SUPPLIER_TYPE_MAP,
  PAYMENT_TERMS_MAP,
  SUPPLIER_ACTIVITY_LABELS,
  SUPPLIER_DOC_TYPES,
  ALLOWED_DOC_TYPES,
  MAX_DOC_SIZE_BYTES,
  PHONE_REGEX,
  EMAIL_REGEX,
} from "@/lib/constants/suppliers"
import {
  getSupplier,
  getSupplierActivityLog,
  getSupplierDocuments,
  updateSupplier,
  archiveSupplier,
  deleteSupplier,
  uploadSupplierDocument,
  deleteSupplierDocument,
  getUserFullNameForSuppliers,
} from "@/lib/actions/suppliers"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import type {
  Supplier,
  SupplierDocument,
  SupplierActivity,
  SupplierTab,
  SupplierUpdateInput,
  SupplierPaymentTerms,
  SupplierStatus,
} from "@/lib/types/suppliers"

/* ── Tab Config ───────────────────────────────────────────── */

const TABS: { key: SupplierTab; label: string; icon: string }[] = [
  { key: "details", label: "פרטים", icon: "person" },
  { key: "documents", label: "מסמכים", icon: "description" },
  { key: "activity", label: "פעילות", icon: "history" },
  { key: "links", label: "קישורים", icon: "link" },
]

/* ── Activity dot color by action ─────────────────────────── */

const ACTIVITY_DOT_COLOR: Record<string, string> = {
  created: "bg-emerald-500",
  updated: "bg-blue-500",
  status_changed: "bg-amber-500",
  archived: "bg-slate-400",
  restored: "bg-emerald-400",
  document_uploaded: "bg-indigo-500",
  document_deleted: "bg-red-400",
  linked_to_task: "bg-purple-500",
  linked_to_issue: "bg-orange-500",
}

/* ── Props ─────────────────────────────────────────────────── */

interface SupplierDetailPanelProps {
  supplierId: string | null
  onClose: () => void
  onUpdated: () => void
}

/* ── Component ─────────────────────────────────────────────── */

export function SupplierDetailPanel({ supplierId, onClose, onUpdated }: SupplierDetailPanelProps) {
  const { tenantId, userId } = useTenant()
  const { can } = usePermissions()
  const canEdit = can("suppliers", "edit")
  const canDelete = can("suppliers", "delete")

  const isOpen = supplierId !== null

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<SupplierTab>("details")
  const [isEditing, setIsEditing] = useState(false)

  const loadSupplier = useCallback(async () => {
    if (!supplierId) return
    setLoading(true)
    const data = await getSupplier(tenantId, supplierId)
    setSupplier(data)
    setLoading(false)
  }, [supplierId, tenantId])

  useEffect(() => {
    if (isOpen) {
      loadSupplier()
      setActiveTab("details")
      setIsEditing(false)
    } else {
      setSupplier(null)
    }
  }, [isOpen, loadSupplier])

  function handleClose() {
    setIsEditing(false)
    onClose()
  }

  function handleSaved() {
    loadSupplier()
    onUpdated()
    setIsEditing(false)
  }

  /* ── Details tab footer ── */
  const detailsFooter = supplier && activeTab === "details" ? (
    <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between flex-row-reverse">
      {isEditing ? (
        <>
          <button
            onClick={() => setIsEditing(false)}
            className="btn btn-outline"
          >
            ביטול
          </button>
          <button
            form="supplier-edit-form"
            type="submit"
            className="btn btn-primary"
          >
            <Icon name="check_circle" size="sm" className="text-white" />
            שמור שינויים
          </button>
        </>
      ) : (
        <>
          {canDelete && (
            <button
              onClick={() => {
                toast("האם למחוק את הספק?", {
                  action: { label: "מחק", onClick: () => handleDeleteSupplier() },
                  cancel: { label: "ביטול", onClick: () => {} },
                })
              }}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 font-bold text-xs transition-colors min-h-[44px] px-4 py-2"
            >
              <Icon name="delete" size="sm" />
              מחק ספק
            </button>
          )}
          <div />
        </>
      )}
    </div>
  ) : undefined

  async function handleDeleteSupplier() {
    if (!supplier) return
    const userName = await getUserFullNameForSuppliers(tenantId, userId)
    const result = await deleteSupplier(tenantId, supplier.id, userId, userName)
    if (!result.success) {
      toast.error(result.error ?? "שגיאה במחיקה")
      return
    }
    toast.success("הספק נמחק")
    handleSaved()
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={supplier?.display_name ?? "פרטי ספק"}
      subtitle={supplier?.company_name ?? ""}
      footer={detailsFooter}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
          <p className="text-sm font-medium">טוען פרטי ספק...</p>
        </div>
      ) : !supplier ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="person_off" size="xl" className="opacity-30" />
          <p className="text-lg font-medium">ספק לא נמצא</p>
        </div>
      ) : (
        <>
          {/* Tab Navigation — Azure Ethos Subtle Card (Variation 3) */}
          <div className="mb-5 flex justify-end">
            <div className="inline-flex bg-[#f4f2fc] p-1 rounded-xl flex-wrap" dir="rtl">
              {TABS.map((tab) => {
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                      active
                        ? "bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                        : "text-[#474747] hover:text-[#1e40af] font-medium"
                    }`}
                  >
                    <Icon name={tab.icon} size="sm" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "details" && (
            <DetailsTab
              supplier={supplier}
              isEditing={isEditing}
              canEdit={canEdit}
              onEdit={() => setIsEditing(true)}
              onSaved={handleSaved}
              tenantId={tenantId}
              userId={userId}
            />
          )}
          {activeTab === "documents" && (
            <DocumentsTab supplier={supplier} canEdit={canEdit} tenantId={tenantId} userId={userId} />
          )}
          {activeTab === "activity" && (
            <ActivityTab supplierId={supplier.id} tenantId={tenantId} />
          )}
          {activeTab === "links" && <LinksTab />}
        </>
      )}
    </SidePanel>
  )
}

/* ══════════════════════════════════════════════════════════════
   DETAILS TAB
   ══════════════════════════════════════════════════════════════ */

interface DetailsTabProps {
  supplier: Supplier
  isEditing: boolean
  canEdit: boolean
  onEdit: () => void
  onSaved: () => void
  tenantId: string
  userId: string
}

function DetailsTab({ supplier, isEditing, canEdit, onEdit, onSaved, tenantId, userId }: DetailsTabProps) {
  const [form, setForm] = useState<SupplierUpdateInput>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEditing) {
      setForm({
        display_name: supplier.display_name,
        company_name: supplier.company_name,
        contact_person: supplier.contact_person,
        supplier_type: supplier.supplier_type,
        phone: supplier.phone,
        mobile: supplier.mobile,
        email: supplier.email,
        website: supplier.website,
        address: supplier.address,
        city: supplier.city,
        tax_id: supplier.tax_id,
        bank_name: supplier.bank_name,
        bank_branch: supplier.bank_branch,
        bank_account: supplier.bank_account,
        payment_terms: supplier.payment_terms,
        notes: supplier.notes,
        internal_notes: supplier.internal_notes,
      })
      setErrors({})
    }
  }, [isEditing, supplier])

  function updateField<K extends keyof SupplierUpdateInput>(key: K, value: SupplierUpdateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => { const next = { ...prev }; delete next[key]; return next })
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.display_name?.trim()) errs.display_name = "חובה להזין שם תצוגה"
    if (form.phone && !PHONE_REGEX.test(form.phone)) errs.phone = "מספר טלפון לא תקין"
    if (form.mobile && !PHONE_REGEX.test(form.mobile)) errs.mobile = "מספר נייד לא תקין"
    if (form.email && !EMAIL_REGEX.test(form.email)) errs.email = "אימייל לא תקין"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const userName = await getUserFullNameForSuppliers(tenantId, userId)
    const result = await updateSupplier(tenantId, supplier.id, form, userId, userName)
    setSaving(false)
    if (!result.success) { toast.error(result.error ?? "שגיאה בעדכון ספק"); return }
    toast.success("הספק עודכן בהצלחה")
    onSaved()
  }

  async function handleStatusChange(newStatus: SupplierStatus) {
    const userName = await getUserFullNameForSuppliers(tenantId, userId)
    if (newStatus === "archived") {
      const result = await archiveSupplier(tenantId, supplier.id, userId, userName)
      if (!result.success) { toast.error(result.error ?? "שגיאה בארכיון"); return }
      toast.success("הספק הועבר לארכיון")
    } else {
      const result = await updateSupplier(tenantId, supplier.id, { status: newStatus }, userId, userName)
      if (!result.success) { toast.error(result.error ?? "שגיאה בעדכון סטטוס"); return }
      toast.success("הסטטוס עודכן")
    }
    onSaved()
  }

  const statusCfg = SUPPLIER_STATUS_MAP[supplier.status]
  const typeCfg = SUPPLIER_TYPE_MAP[supplier.supplier_type]
  const paymentCfg = PAYMENT_TERMS_MAP[supplier.payment_terms]
  const errorRing = "ring-2 ring-red-400"

  /* ── Edit Mode ── */
  if (isEditing) {
    return (
      <form id="supplier-edit-form" onSubmit={handleSave} className="space-y-5">
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">פרטי הספק</h3>
          </div>
          <FormField label="שם תצוגה" required error={errors.display_name}>
            <input type="text" value={form.display_name ?? ""} onChange={(e) => updateField("display_name", e.target.value)} className={`${inputClass} ${errors.display_name ? errorRing : ""}`} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="שם חברה">
              <input type="text" value={form.company_name ?? ""} onChange={(e) => updateField("company_name", e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="סוג ספק">
              <select value={form.supplier_type ?? "general"} onChange={(e) => updateField("supplier_type", e.target.value)} className={selectClass}>
                {SUPPLIER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="איש קשר">
            <input type="text" value={form.contact_person ?? ""} onChange={(e) => updateField("contact_person", e.target.value)} className={inputClass} />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="טלפון" error={errors.phone}>
              <input type="tel" value={form.phone ?? ""} onChange={(e) => updateField("phone", e.target.value)} className={`${inputClass} ${errors.phone ? errorRing : ""}`} dir="ltr" />
            </FormField>
            <FormField label="נייד" error={errors.mobile}>
              <input type="tel" value={form.mobile ?? ""} onChange={(e) => updateField("mobile", e.target.value)} className={`${inputClass} ${errors.mobile ? errorRing : ""}`} dir="ltr" />
            </FormField>
          </div>
          <FormField label="אימייל" error={errors.email}>
            <input type="email" value={form.email ?? ""} onChange={(e) => updateField("email", e.target.value)} className={`${inputClass} ${errors.email ? errorRing : ""}`} dir="ltr" />
          </FormField>
        </div>

        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">כתובת ופרטים נוספים</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="כתובת">
              <input type="text" value={form.address ?? ""} onChange={(e) => updateField("address", e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="עיר">
              <input type="text" value={form.city ?? ""} onChange={(e) => updateField("city", e.target.value)} className={inputClass} />
            </FormField>
          </div>
          <FormField label="אתר אינטרנט">
            <input type="url" value={form.website ?? ""} onChange={(e) => updateField("website", e.target.value)} className={inputClass} dir="ltr" />
          </FormField>
          <FormField label="ח.פ / ע.מ">
            <input type="text" value={form.tax_id ?? ""} onChange={(e) => updateField("tax_id", e.target.value)} className={inputClass} dir="ltr" />
          </FormField>
          <FormField label="הערות">
            <textarea value={form.notes ?? ""} onChange={(e) => updateField("notes", e.target.value)} className={textareaClass} rows={3} />
          </FormField>
          <FormField label="הערות פנימיות">
            <textarea value={form.internal_notes ?? ""} onChange={(e) => updateField("internal_notes", e.target.value)} className={textareaClass} rows={2} />
          </FormField>
        </div>

        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">תנאי תשלום</h3>
          </div>
          <FormField label="תנאי תשלום">
            <select value={form.payment_terms ?? "net_30"} onChange={(e) => updateField("payment_terms", e.target.value as SupplierPaymentTerms)} className={selectClass}>
              {Object.entries(PAYMENT_TERMS_MAP).map(([value, cfg]) => (
                <option key={value} value={value}>{cfg.label}</option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="שם בנק">
              <input type="text" value={form.bank_name ?? ""} onChange={(e) => updateField("bank_name", e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="סניף">
              <input type="text" value={form.bank_branch ?? ""} onChange={(e) => updateField("bank_branch", e.target.value)} className={inputClass} dir="ltr" />
            </FormField>
            <FormField label="מספר חשבון">
              <input type="text" value={form.bank_account ?? ""} onChange={(e) => updateField("bank_account", e.target.value)} className={inputClass} dir="ltr" />
            </FormField>
          </div>
        </div>

        {/* Hidden submit for footer button */}
        <button type="submit" disabled={saving} className="hidden" />
      </form>
    )
  }

  /* ── View Mode ── */
  return (
    <div className="space-y-5">
      {/* Status + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className={`px-4 py-2 rounded-full text-sm font-bold ${statusCfg.bg} ${statusCfg.text}`}>
          {statusCfg.label}
        </span>
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onEdit} className="flex items-center gap-1.5 bg-card text-foreground font-bold text-sm rounded-full border border-border/30 shadow-sm hover:shadow-md transition-all min-h-[44px] px-5 py-2.5">
              <Icon name="edit" size="sm" />
              עריכה
            </button>
            {supplier.status === "active" && (
              <button onClick={() => handleStatusChange("inactive")} className="flex items-center gap-1.5 text-muted-foreground font-bold text-sm rounded-full border border-border/20 hover:bg-accent transition-colors min-h-[44px] px-5 py-2.5">
                <Icon name="block" size="sm" />
                השבתה
              </button>
            )}
            {supplier.status === "inactive" && (
              <button onClick={() => handleStatusChange("active")} className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-sm rounded-full border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors min-h-[44px] px-5 py-2.5">
                <Icon name="check_circle" size="sm" />
                הפעלה
              </button>
            )}
            {supplier.status !== "archived" && (
              <button onClick={() => handleStatusChange("archived")} className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-sm rounded-full border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors min-h-[44px] px-5 py-2.5">
                <Icon name="archive" size="sm" />
                ארכיון
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contact Info Card */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <h3 className="text-base font-bold text-foreground">פרטי קשר</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="שם" value={supplier.display_name} />
          {supplier.company_name && <InfoCard label="חברה" value={supplier.company_name} />}
          {supplier.contact_person && <InfoCard label="איש קשר" value={supplier.contact_person} />}
          {typeCfg && <InfoCard label="סוג" value={typeCfg.label} />}
          {supplier.phone && <InfoCard label="טלפון" value={supplier.phone} dir="ltr" />}
          {supplier.mobile && <InfoCard label="נייד" value={supplier.mobile} dir="ltr" />}
          {supplier.email && <InfoCard label="אימייל" value={supplier.email} dir="ltr" />}
          {supplier.website && <InfoCard label="אתר" value={supplier.website} dir="ltr" />}
        </div>
      </div>

      {/* Address Info Card */}
      {(supplier.address || supplier.city || supplier.tax_id) && (
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">כתובת ופרטים</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {supplier.address && <InfoCard label="כתובת" value={supplier.address} />}
            {supplier.city && <InfoCard label="עיר" value={supplier.city} />}
            {supplier.tax_id && <InfoCard label="ח.פ / ע.מ" value={supplier.tax_id} dir="ltr" />}
          </div>
        </div>
      )}

      {/* Payment Info Card */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <h3 className="text-base font-bold text-foreground">תנאי תשלום</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="תנאים" value={paymentCfg?.label ?? "—"} />
          {supplier.bank_name && <InfoCard label="בנק" value={supplier.bank_name} />}
          {supplier.bank_branch && <InfoCard label="סניף" value={supplier.bank_branch} dir="ltr" />}
          {supplier.bank_account && <InfoCard label="חשבון" value={supplier.bank_account} dir="ltr" />}
        </div>
      </div>

      {/* Notes */}
      {supplier.notes && (
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">הערות</h3>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{supplier.notes}</p>
        </div>
      )}

      {supplier.internal_notes && (
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-[20px] p-5 shadow-sm border border-amber-200/30 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <h3 className="text-base font-bold text-amber-700 dark:text-amber-400">הערות פנימיות</h3>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{supplier.internal_notes}</p>
        </div>
      )}
    </div>
  )
}

/* ── InfoCard Helper ─────────────────────────────────────── */

function InfoCard({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div className="bg-accent rounded-xl p-3">
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-bold text-foreground truncate" dir={dir}>{value}</p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   DOCUMENTS TAB
   ══════════════════════════════════════════════════════════════ */

function DocumentsTab({ supplier, canEdit, tenantId, userId }: { supplier: Supplier; canEdit: boolean; tenantId: string; userId: string }) {
  const [docs, setDocs] = useState<SupplierDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState("general")
  const [docName, setDocName] = useState("")
  const [viewerDoc, setViewerDoc] = useState<SupplierDocument | null>(null)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    const data = await getSupplierDocuments(tenantId, supplier.id)
    setDocs(data)
    setLoading(false)
  }, [tenantId, supplier.id])

  useEffect(() => { loadDocs() }, [loadDocs])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!docName.trim()) { toast.error("חובה להזין שם למסמך לפני העלאה"); e.target.value = ""; return }
    if (!ALLOWED_DOC_TYPES.includes(file.type)) { toast.error("סוג קובץ לא נתמך. השתמשו ב-PDF, Word, Excel או תמונה."); return }
    if (file.size > MAX_DOC_SIZE_BYTES) { toast.error("הקובץ גדול מדי. מקסימום 10MB."); return }

    setUploading(true)
    const fakeUrl = URL.createObjectURL(file)
    const displayName = docName.trim()
    const userName = await getUserFullNameForSuppliers(tenantId, userId)
    const result = await uploadSupplierDocument(tenantId, supplier.id, { url: fakeUrl, name: displayName, mime: file.type, size: file.size }, selectedDocType, userId, userName)
    setUploading(false)

    if (!result.success) { toast.error(result.error ?? "שגיאה בהעלאת מסמך"); return }
    toast.success("המסמך הועלה בהצלחה")
    setDocName("")
    loadDocs()
    e.target.value = ""
  }

  async function handleDeleteDoc(docId: string) {
    const userName = await getUserFullNameForSuppliers(tenantId, userId)
    const result = await deleteSupplierDocument(tenantId, docId, userId, userName)
    if (!result.success) { toast.error(result.error ?? "שגיאה במחיקת מסמך"); return }
    toast.success("המסמך נמחק")
    loadDocs()
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" })
  }

  return (
    <div className="space-y-5">
      {/* Upload Area */}
      {canEdit && (
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">העלאת מסמך</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="שם מסמך (אופציונלי)">
              <input type="text" value={docName} onChange={(e) => setDocName(e.target.value)} className={inputClass} placeholder="שם המסמך (חובה) — לדוגמה: חוזה התקשרות 2025" />
            </FormField>
            <FormField label="סוג מסמך">
              <select value={selectedDocType} onChange={(e) => setSelectedDocType(e.target.value)} className={selectClass}>
                {SUPPLIER_DOC_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="flex items-center gap-4">
            <label className="btn btn-primary">
              {uploading ? <Icon name="hourglass_empty" size="sm" className="text-white animate-spin" /> : <Icon name="upload" size="sm" className="text-white" />}
              {uploading ? "מעלה..." : "בחר קובץ"}
              <input type="file" className="hidden" accept={ALLOWED_DOC_TYPES.join(",")} onChange={handleFileSelect} disabled={uploading} />
            </label>
            <p className="text-[11px] text-muted-foreground">PDF, Word, Excel או תמונות. מקסימום 10MB.</p>
          </div>
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <Icon name="hourglass_empty" size="lg" className="opacity-30 animate-spin" />
          <p className="text-sm">טוען מסמכים...</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <Icon name="description" size="xl" className="opacity-20" />
          <p className="text-sm">אין מסמכים</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const docTypeCfg = SUPPLIER_DOC_TYPES.find((dt) => dt.value === doc.doc_type)
            return (
              <div key={doc.id} className="bg-accent rounded-xl p-3 flex items-center gap-4">
                <Icon name="description" size="lg" className="text-primary/60 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                    {docTypeCfg && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">{docTypeCfg.label}</span>}
                    <span>{formatFileSize(doc.file_size_bytes)}</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setViewerDoc(doc)}
                  className="text-primary hover:text-primary/70 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="צפה בקובץ"
                >
                  <Icon name="visibility" size="sm" />
                </button>
                {canEdit && (
                  <button
                    onClick={() => {
                      toast("האם למחוק את המסמך?", {
                        action: { label: "מחק", onClick: () => handleDeleteDoc(doc.id) },
                        cancel: { label: "ביטול", onClick: () => {} },
                      })
                    }}
                    className="text-red-500 hover:text-red-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="מחק מסמך"
                  >
                    <Icon name="delete" size="sm" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* File Viewer */}
      <FileViewer
        isOpen={!!viewerDoc}
        onClose={() => setViewerDoc(null)}
        fileUrl={viewerDoc?.file_url ?? ""}
        fileName={viewerDoc?.file_name ?? ""}
        mimeType={viewerDoc?.mime_type ?? ""}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ACTIVITY TAB
   ══════════════════════════════════════════════════════════════ */

function ActivityTab({ supplierId, tenantId }: { supplierId: string; tenantId: string }) {
  const [activities, setActivities] = useState<SupplierActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const data = await getSupplierActivityLog(tenantId, supplierId)
      setActivities(data)
      setLoading(false)
    }
    load()
  }, [tenantId, supplierId])

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("he-IL", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <Icon name="hourglass_empty" size="lg" className="opacity-30 animate-spin" />
        <p className="text-sm">טוען היסטוריה...</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <Icon name="history" size="xl" className="opacity-20" />
        <p className="text-sm">אין פעילות</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {activities.map((act, idx) => {
        const label = SUPPLIER_ACTIVITY_LABELS[act.action_type] ?? act.action_type
        const dotColor = ACTIVITY_DOT_COLOR[act.action_type] ?? "bg-primary/30"
        const isLast = idx === activities.length - 1

        return (
          <div key={act.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${dotColor} flex-shrink-0 mt-1`} />
              {!isLast && <div className="w-0.5 flex-1 bg-border/30 mt-1" />}
            </div>
            <div className="pb-5 min-w-0">
              <p className="text-sm font-bold text-foreground">{label}</p>
              {act.message && <p className="text-[12px] text-muted-foreground mt-0.5">{act.message}</p>}
              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground/70">
                <span>{formatTime(act.created_at)}</span>
                {act.changed_by_name && (
                  <>
                    <span>·</span>
                    <span>{act.changed_by_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   LINKS TAB
   ══════════════════════════════════════════════════════════════ */

function LinksTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <Icon name="link" size="xl" className="opacity-20" />
      <p className="text-sm font-medium">קישורים למשימות ותקלות יתווספו בשלב הבא</p>
    </div>
  )
}
