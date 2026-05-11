"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { DateInput } from "@/components/shared/DateInput"
import { FormField, inputClass } from "@/components/shared/FormField"
import { getRoleLabel, ROLE_STYLES } from "@/lib/permissions/constants"
import type { EmployeeWithPermissions } from "@/lib/types/staff"
import { updateEmployeeProfile } from "@/lib/actions/staff"
import { useTenant } from "@/lib/hooks/use-tenant"

/* ── Props ─────────────────────────────────────────────────── */

interface ProfileTabProps {
  employee: EmployeeWithPermissions
  isEditing: boolean
  onEdit: () => void
  onSaved: () => void
  currentUserId: string
}

/* ── Component ─────────────────────────────────────────────── */

export function ProfileTab({ employee, isEditing, onEdit: _onEdit, onSaved, currentUserId: _currentUserId }: ProfileTabProps) {
  const { tenantId } = useTenant()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    full_name: employee.full_name || "",
    phone: employee.phone || "",
    job_title: employee.job_title || "",
    department: employee.department || "",
    emergency_contact: employee.emergency_contact || "",
    notes: employee.notes || "",
    start_date: employee.start_date || "",
  })

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!isEditing) return
    setSaving(true)
    setError("")
    const res = await updateEmployeeProfile(employee.id, tenantId, {
      full_name: form.full_name,
      phone: form.phone,
      job_title: form.job_title || null,
      department: form.department || null,
      emergency_contact: form.emergency_contact || null,
      notes: form.notes || null,
      start_date: form.start_date || null,
    })
    if (!res.success) {
      setError(res.error || "שגיאה בעדכון")
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
  }

  /* ── Listen for panel-level save trigger ── */
  useEffect(() => {
    const handler = () => { handleSave() }
    document.addEventListener("staff-panel-save", handler)
    return () => document.removeEventListener("staff-panel-save", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, form])

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "---"
    return new Date(dateStr).toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function getInitials(name: string): string {
    if (!name) return "?"
    return name.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join("")
  }

  const style = ROLE_STYLES[employee.role]

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Icon name="error" size="sm" className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* User Info Card */}
      <div className="rounded-xl border border-[#dad9e3] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="info" size="sm" className="text-[#1e40af]" />
          <h3 className="text-base font-bold text-foreground">פרטי עובד</h3>
        </div>

        {isEditing ? (
          /* ── Edit Mode ── */
          <div className="space-y-4">
            <FormField label="שם מלא" required>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="טלפון">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className={inputClass}
                dir="ltr"
                placeholder="050-0000000"
              />
            </FormField>

            <FormField label="תפקיד">
              <input
                type="text"
                value={form.job_title}
                onChange={(e) => updateField("job_title", e.target.value)}
                className={inputClass}
                placeholder="לדוגמה: ראש צוות ניקיון"
              />
            </FormField>

            <FormField label="מחלקה">
              <input
                type="text"
                value={form.department}
                onChange={(e) => updateField("department", e.target.value)}
                className={inputClass}
                placeholder="לדוגמה: תפעול"
              />
            </FormField>

            <FormField label="תאריך תחילת עבודה">
              <DateInput value={form.start_date} onChange={(val) => updateField("start_date", val)} />
            </FormField>

            <FormField label="איש קשר לחירום">
              <input
                type="text"
                value={form.emergency_contact}
                onChange={(e) => updateField("emergency_contact", e.target.value)}
                className={inputClass}
                placeholder="שם + טלפון"
              />
            </FormField>

            <FormField label="הערות">
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className={`${inputClass} min-h-[80px] resize-none`}
                placeholder="הערות פנימיות..."
              />
            </FormField>
            {saving && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Icon name="hourglass_empty" size="sm" className="animate-spin" />
                שומר שינויים...
              </p>
            )}
          </div>
        ) : (
          /* ── View Mode ── */
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0 text-lg">
              {getInitials(employee.full_name)}
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-base font-bold">{employee.full_name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-1">
                  {employee.email && (
                    <span className="flex items-center gap-1" dir="ltr">
                      <Icon name="email" size="sm" className="text-muted-foreground/60" />
                      {employee.email}
                    </span>
                  )}
                  {employee.phone && (
                    <span className="flex items-center gap-1" dir="ltr">
                      <Icon name="phone" size="sm" className="text-muted-foreground/60" />
                      {employee.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Role + Status */}
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className={`px-3 py-1.5 rounded-full font-bold ${style?.badge || "bg-slate-100 text-slate-600"}`}>
                  {getRoleLabel(employee.role)}
                </span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className={`w-2.5 h-2.5 rounded-full ${employee.is_active ? "bg-emerald-500" : "bg-gray-300"}`} />
                  <span className="font-bold">{employee.is_active ? "פעיל" : "מושבת"}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Extended Info (View Mode) */}
      {!isEditing && (
        <div className="rounded-xl border border-[#dad9e3] bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="info" size="sm" className="text-[#1e40af]" />
            <h3 className="text-base font-bold text-foreground">מידע נוסף</h3>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
            <InfoRow label="תפקיד" value={employee.job_title} accent />
            <InfoRow label="מחלקה" value={employee.department} accent />
            <InfoRow label="תחילת עבודה" value={employee.start_date ? new Date(employee.start_date).toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" }) : null} />
            <InfoRow label="איש קשר לחירום" value={employee.emergency_contact} />
            <InfoRow label="התחברות אחרונה" value={formatDate(employee.last_login)} />
            <InfoRow label="הצטרפות" value={formatDate(employee.created_at)} />
          </div>
          {employee.notes && (
            <div className="mt-4 pt-4 border-t border-[#f4f2fc]">
              <p className="text-xs font-bold text-muted-foreground mb-1">הערות</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{employee.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Helper ────────────────────────────────────────────────── */

function InfoRow({ label, value, accent }: { label: string; value: string | null | undefined; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-bold ${accent ? "text-[#1e40af]" : "text-foreground"}`}>{value || "—"}</p>
    </div>
  )
}
