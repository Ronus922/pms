"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { DateInput } from "@/components/shared/DateInput"
import { FormField, inputClass } from "@/components/shared/FormField"
import { getRoleLabel, ROLE_STYLES } from "@/lib/permissions/constants"
import type { EmployeeWithPermissions } from "@/lib/types/staff"
import { updateEmployeeProfile } from "@/lib/actions/staff"
import {
  updateUserAuthSettings,
  resetUserPassword,
  resendCredentialsToUser,
} from "@/lib/actions/permissions"
import { useTenant } from "@/lib/hooks/use-tenant"
import { asciiOnly } from "@/lib/utils/text-filters"

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

  /* ── Auth settings state ─────────────────────────────────── */
  const [username, setUsername] = useState(employee.username || "")
  const [originalUsername, setOriginalUsername] = useState(employee.username || "")
  const [allowGoogleAuth, setAllowGoogleAuth] = useState(employee.allow_google_auth ?? false)
  const [originalAllowGoogleAuth, setOriginalAllowGoogleAuth] = useState(employee.allow_google_auth ?? false)
  /* Inline password set — empty means "leave unchanged". Sent to the server
   * only when length >= 8. Cleared on every successful save. */
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  /* ── Reset password modal state ──────────────────────────── */
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [emailNewPassword, setEmailNewPassword] = useState(true)
  const [resetResult, setResetResult] = useState<{ password: string } | null>(null)
  const [authActionPending, setAuthActionPending] = useState(false)

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError("")

    /* Profile fields — only when in edit mode (those inputs are gated by isEditing) */
    if (isEditing) {
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
    }

    /* Auth settings — always-editable, save whenever they changed */
    const authChanged =
      username.trim() !== originalUsername.trim() ||
      allowGoogleAuth !== originalAllowGoogleAuth
    if (authChanged) {
      const authRes = await updateUserAuthSettings(employee.id, tenantId, {
        username: username.trim() || null,
        allowGoogleAuth,
      })
      if (!authRes.success) {
        setError(authRes.error || "שגיאה בעדכון הגדרות התחברות")
        setSaving(false)
        return
      }
      setOriginalUsername(username.trim())
      setOriginalAllowGoogleAuth(allowGoogleAuth)
    }

    /* Inline password — only sent when admin typed a valid value.
     * Empty stays untouched, < 8 chars blocks the save with inline error. */
    const trimmedPassword = password.trim()
    if (trimmedPassword.length > 0) {
      if (trimmedPassword.length < 8) {
        setError("סיסמה חייבת להכיל לפחות 8 תווים")
        setSaving(false)
        return
      }
      const pwRes = await resetUserPassword(employee.id, tenantId, trimmedPassword, {
        sendEmail: false,
      })
      if (!pwRes.success) {
        setError(pwRes.error || "שגיאה בעדכון הסיסמה")
        setSaving(false)
        return
      }
      setPassword("")
      setShowPassword(false)
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
  }, [isEditing, form, username, allowGoogleAuth, password, originalUsername, originalAllowGoogleAuth])

  /* ── Auth side-actions (independent of edit mode) ────────── */
  async function handleResetPassword() {
    if (newPassword.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים")
      return
    }
    setAuthActionPending(true)
    setError("")
    const res = await resetUserPassword(employee.id, tenantId, newPassword, {
      sendEmail: emailNewPassword,
    })
    if (!res.success) {
      setError(res.error || "שגיאה באיפוס הסיסמה")
      setAuthActionPending(false)
      return
    }
    setResetResult({ password: newPassword })
    setNewPassword("")
    setShowResetPassword(false)
    setAuthActionPending(false)
  }

  async function handleResendCredentials() {
    setAuthActionPending(true)
    setError("")
    const res = await resendCredentialsToUser(employee.id, tenantId)
    if (!res.success) {
      setError(res.error || "שגיאה בשליחת הקישור")
    }
    setAuthActionPending(false)
  }

  function generateRandomPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    let out = ""
    for (let i = 0; i < 10; i++) {
      out += chars[Math.floor(Math.random() * chars.length)]
    }
    setNewPassword(out)
  }

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

      {/* Auth Settings Card */}
      <div className="rounded-xl border border-[#dad9e3] bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="key" size="sm" className="text-[#1e40af]" />
          <h3 className="text-base font-bold text-foreground">הגדרות התחברות</h3>
        </div>

        <FormField label="שם משתמש">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(asciiOnly(e.target.value))}
            className={inputClass}
            placeholder="ללא שם משתמש — רק אימייל"
            dir="ltr"
            lang="en"
            inputMode="email"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            אם תוגדר — העובד יוכל להתחבר גם עם שם המשתמש במקום אימייל.
          </p>
        </FormField>

        <FormField label="סיסמה">
          <div className="relative">
            <Icon
              name="lock"
              size="sm"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type={showPassword ? "text" : "password"}
              name={`np_${employee.id}`}
              value={password}
              onChange={(e) => setPassword(asciiOnly(e.target.value))}
              className={`${inputClass} pr-11 pl-12`}
              placeholder="השאר ריק כדי לא לשנות סיסמה"
              dir="ltr"
              lang="en"
              inputMode="text"
              autoComplete="new-password"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
              className="absolute left-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-border/40 text-muted-foreground"
            >
              <Icon name={showPassword ? "visibility_off" : "visibility"} size="sm" />
            </button>
          </div>
          {password.length > 0 && password.length < 8 ? (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-bold">
              הסיסמה חייבת להכיל לפחות 8 תווים
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-1">
              לקביעת סיסמה ראשונית — לעובדים בלי אימייל פעיל. הסיסמה לא תוצג שוב לאחר השמירה.
            </p>
          )}
        </FormField>

        <label className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-accent/30 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={allowGoogleAuth}
            onChange={(e) => setAllowGoogleAuth(e.target.checked)}
            className="w-5 h-5 rounded border-border/40 text-primary focus:ring-primary/20 accent-primary"
          />
          <div className="flex-1">
            <p className="text-sm font-bold">אפשר התחברות עם Google</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              כשכבוי, ניסיון Google sign-in למייל שלו ייחסם.
            </p>
          </div>
        </label>

        <div className="flex flex-wrap gap-2 pt-3 border-t border-[#f4f2fc]">
          <button
            type="button"
            onClick={() => setShowResetPassword(true)}
            disabled={authActionPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-border/40 text-sm font-bold transition-colors min-h-[44px] disabled:opacity-50"
          >
            <Icon name="key" size="sm" />
            איפוס סיסמה
          </button>
          <button
            type="button"
            onClick={handleResendCredentials}
            disabled={authActionPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-border/40 text-sm font-bold transition-colors min-h-[44px] disabled:opacity-50"
          >
            <Icon name="send" size="sm" />
            שלח קישור התחברות במייל
          </button>
        </div>

        {showResetPassword && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <Icon name="warning" size="sm" className="text-amber-600" />
              איפוס סיסמה
            </h4>
            <FormField label="סיסמה חדשה">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="הקלד או לחץ 'צור אוטומטית'"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="px-3 py-2 rounded-xl bg-white border border-border/40 text-sm font-bold whitespace-nowrap min-h-[44px]"
                >
                  צור אוטומטית
                </button>
              </div>
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={emailNewPassword}
                onChange={(e) => setEmailNewPassword(e.target.checked)}
                className="w-4 h-4 rounded border-border/40 accent-primary"
              />
              שלח את הסיסמה החדשה במייל לעובד
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={authActionPending || newPassword.length < 6}
                className="flex-1 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 min-h-[44px]"
              >
                {authActionPending ? "שומר..." : "אפס סיסמה"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetPassword(false)
                  setNewPassword("")
                }}
                className="px-4 py-2 rounded-xl text-sm bg-accent hover:bg-border/40 min-h-[44px]"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {resetResult && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4 space-y-2">
            <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Icon name="check_circle" size="sm" />
              הסיסמה אופסה בהצלחה
            </h4>
            <div className="bg-white dark:bg-black/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
              <div className="text-[11px] text-muted-foreground mb-1">סיסמה חדשה</div>
              <div dir="ltr" className="font-mono text-base font-bold select-all">
                {resetResult.password}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              שמור את הסיסמה כעת — לא תוצג שוב. {emailNewPassword ? "נשלחה גם במייל לעובד." : ""}
            </p>
            <button
              type="button"
              onClick={() => setResetResult(null)}
              className="text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
            >
              סגור
            </button>
          </div>
        )}

      </div>
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
