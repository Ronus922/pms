"use client"

import { useEffect, useState, useCallback } from "react"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass } from "@/components/shared/FormField"
import { RoleSelector } from "@/components/staff/RoleSelector"
import { ProfileTab } from "@/components/staff/tabs/ProfileTab"
import { AttendanceTab } from "@/components/staff/tabs/AttendanceTab"
import { PermissionsTab } from "@/components/staff/tabs/PermissionsTab"
import { ActivityTab } from "@/components/staff/tabs/ActivityTab"
import { TasksTab } from "@/components/staff/tabs/TasksTab"
import { HoursTab } from "@/components/staff/tabs/HoursTab"
import { useStaffStore } from "@/lib/stores/staff-store"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import { getEmployeeProfile } from "@/lib/actions/staff"
import { inviteUser } from "@/lib/actions/permissions"
import { ROLES, type Role } from "@/lib/permissions/constants"
import type { EmployeeWithPermissions, StaffTab } from "@/lib/types/staff"
import { asciiOnly } from "@/lib/utils/text-filters"

/* ── Tab Config ────────────────────────────────────────────── */

const TABS: { key: StaffTab; label: string; icon: string }[] = [
  { key: "profile", label: "פרופיל", icon: "person" },
  { key: "attendance", label: "דיווח", icon: "schedule" },
  { key: "permissions", label: "הרשאות", icon: "admin_panel_settings" },
  { key: "activity", label: "פעילות", icon: "history" },
  { key: "tasks", label: "משימות", icon: "assignment" },
  { key: "hours", label: "דיווח שעות", icon: "schedule" },
]

/* ── Props ─────────────────────────────────────────────────── */

interface EmployeeSidePanelProps {
  onSaved: () => void
}

/* ── Component ─────────────────────────────────────────────── */

export function EmployeeSidePanel({ onSaved }: EmployeeSidePanelProps) {
  const { tenantId, userId: currentUserId } = useTenant()
  const { isSuperAdmin, isAdmin } = usePermissions()

  const {
    selectedEmployeeId,
    panelMode,
    activeTab,
    closePanel,
    setTab,
    setEditMode,
    setViewMode,
  } = useStaffStore()

  const isOpen = selectedEmployeeId !== null
  const isInvite = panelMode === "invite"

  /* ── Employee Data ── */
  const [employee, setEmployee] = useState<EmployeeWithPermissions | null>(null)
  const [loading, setLoading] = useState(false)

  /* ── Invite Form ── */
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    username: "",
    allowGoogleAuth: true,
    enableUsernameLogin: false,
    sendCredentials: true,
  })
  const [inviteRole, setInviteRole] = useState<Role | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showInvitePassword, setShowInvitePassword] = useState(false)

  const [notFound, setNotFound] = useState(false)

  /* ── Load Employee ── */
  const loadEmployee = useCallback(async () => {
    if (!selectedEmployeeId || isInvite) return
    setLoading(true)
    setNotFound(false)
    const data = await getEmployeeProfile(selectedEmployeeId, tenantId)
    if (!data) {
      setNotFound(true)
      setEmployee(null)
    } else {
      setEmployee(data)
    }
    setLoading(false)
  }, [selectedEmployeeId, tenantId, isInvite])

  useEffect(() => {
    if (isOpen && !isInvite) {
      loadEmployee()
    }
    if (isInvite) {
      setEmployee(null)
      setInviteForm({
        fullName: "",
        email: "",
        phone: "",
        password: "",
        username: "",
        allowGoogleAuth: true,
        enableUsernameLogin: false,
        sendCredentials: true,
      })
      setInviteRole(null)
      setError("")
      setShowInvitePassword(false)
    }
  }, [isOpen, isInvite, loadEmployee])

  useEffect(() => {
    if (!isOpen) {
      setEmployee(null)
      setError("")
      setNotFound(false)
    }
  }, [isOpen])

  /* ── Invite Handler ── */
  async function handleInvite() {
    if (!inviteForm.fullName.trim()) {
      setError("שם מלא הוא שדה חובה")
      return
    }
    if (!inviteForm.phone.trim()) {
      setError("טלפון הוא שדה חובה")
      return
    }
    if (!inviteRole) {
      setError("יש לבחור תפקיד")
      return
    }
    if (!inviteForm.allowGoogleAuth && !inviteForm.enableUsernameLogin) {
      setError("יש לסמן לפחות שיטת התחברות אחת — Google או שם משתמש וסיסמה")
      return
    }
    if (inviteForm.allowGoogleAuth && !inviteForm.email.trim()) {
      setError("התחברות עם Google דורשת אימייל")
      return
    }
    const trimmedUsername = inviteForm.username.trim()
    const trimmedPassword = inviteForm.password.trim()
    if (inviteForm.enableUsernameLogin && !trimmedUsername) {
      setError("שם משתמש הוא שדה חובה כשהתחברות עם שם משתמש מופעלת")
      return
    }
    if (inviteForm.enableUsernameLogin && trimmedPassword.length > 0 && trimmedPassword.length < 8) {
      setError("הסיסמה חייבת להכיל לפחות 8 תווים")
      return
    }
    setSaving(true)
    setError("")

    /* Auth-method routing:
     * - Username/password disabled → no username sent; server-generated temp
     *   password (unused if Google-only).
     * - Enabled with manual password → admin's password used.
     * - Enabled without password → server temp + credentials email forced. */
    const hasManualPassword =
      inviteForm.enableUsernameLogin && trimmedPassword.length >= 8
    const needsCredentialsEmail =
      inviteForm.enableUsernameLogin && !hasManualPassword
    const res = await inviteUser(tenantId, currentUserId, {
      email: inviteForm.email.trim(),
      fullName: inviteForm.fullName.trim(),
      phone: inviteForm.phone.trim(),
      role: inviteRole as Role,
      password: hasManualPassword ? trimmedPassword : "",
      username: inviteForm.enableUsernameLogin ? trimmedUsername || null : null,
      allowGoogleAuth: inviteForm.allowGoogleAuth,
      sendCredentials: needsCredentialsEmail ? true : inviteForm.sendCredentials,
    })

    if (!res.success) {
      setError(res.error || "שגיאה ביצירת העובד")
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved()
    closePanel()
  }

  /* ── Saved handler ── */
  function handleSaved() {
    loadEmployee()
    onSaved()
    setViewMode()
  }

  /* ── Assignable roles ── */
  const assignableRoleValues: Role[] = ROLES
    .filter((r) => {
      if (isSuperAdmin) return true
      if (isAdmin && (r.value === "receptionist" || r.value === "cleaner")) return true
      return false
    })
    .map((r) => r.value)

  /* ── Render ──────────────────────────────────────────────── */

  /* ── Avatar initials ── */
  function getInitials(name: string): string {
    if (!name) return "?"
    return name.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join("").toUpperCase()
  }

  /* ── Toggle active (panel-level) ── */
  async function handleTogglePanelActive() {
    if (!employee) return
    const { toggleUserActive } = await import("@/lib/actions/permissions")
    const res = await toggleUserActive(employee.id, tenantId, !employee.is_active)
    if (!res.success) {
      setError(res.error || "שגיאה בעדכון סטטוס")
      return
    }
    handleSaved()
  }

  /* ── Footer save trigger (delegates to active tab via event) ── */
  function handleFooterSave() {
    document.dispatchEvent(new CustomEvent("staff-panel-save"))
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={closePanel}
      title={isInvite ? "הוספת עובד חדש" : employee?.full_name || "פרטי עובד"}
      subtitle={isInvite ? "יצירת משתמש חדש במערכת" : employee?.email || ""}
      noPadding
      hideDefaultHeader={!isInvite}
    >
      <div className="flex flex-col h-full min-h-0 bg-white">
        {/* ── Error Banner ── */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3 shrink-0">
            <Icon name="error" size="sm" className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {isInvite ? (
          /* ─── INVITE MODE ─────────────────────────────────── */
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Form Fields */}
              <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
                <h3 className="text-base font-bold text-foreground mb-1">פרטי העובד</h3>

                <FormField label="שם מלא" required>
                  <input
                    type="text"
                    value={inviteForm.fullName}
                    onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))}
                    className={inputClass}
                    placeholder="שם פרטי ומשפחה"
                  />
                </FormField>

                <FormField label="טלפון" required>
                  <input
                    type="tel"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
                    className={inputClass}
                    placeholder="050-0000000"
                    dir="ltr"
                    inputMode="tel"
                  />
                </FormField>

                <FormField label="אימייל">
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputClass}
                    placeholder="email@example.com — חובה רק להתחברות עם Google"
                    dir="ltr"
                  />
                </FormField>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-accent/30 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={inviteForm.allowGoogleAuth}
                    onChange={(e) => setInviteForm((f) => ({ ...f, allowGoogleAuth: e.target.checked }))}
                    className="w-5 h-5 rounded border-border/40 text-primary focus:ring-primary/20 accent-primary"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold">אפשר התחברות עם Google</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      העובד יוכל להתחבר בלחיצה על &ldquo;התחבר עם Google&rdquo; — צריך רק אימייל
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-accent/30 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={inviteForm.enableUsernameLogin}
                    onChange={(e) => setInviteForm((f) => ({ ...f, enableUsernameLogin: e.target.checked }))}
                    className="w-5 h-5 rounded border-border/40 text-primary focus:ring-primary/20 accent-primary"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold">אפשר התחברות עם שם משתמש וסיסמה</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      לעובדים בלי אימייל פעיל — מנהל קובע שם משתמש וסיסמה
                    </p>
                  </div>
                </label>

                {inviteForm.enableUsernameLogin && (
                  <>
                    <FormField label="שם משתמש" required>
                      <input
                        type="text"
                        value={inviteForm.username}
                        onChange={(e) =>
                          setInviteForm((f) => ({ ...f, username: asciiOnly(e.target.value) }))
                        }
                        className={inputClass}
                        placeholder="לדוגמה: yossi-reception"
                        dir="ltr"
                        lang="en"
                        inputMode="email"
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        אותיות באנגלית, ספרות, נקודה / מקף / קו תחתון בלבד
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
                          type={showInvitePassword ? "text" : "password"}
                          name={`np_${employee?.id ?? "new"}_${selectedEmployeeId ?? "x"}`}
                          value={inviteForm.password}
                          onChange={(e) =>
                            setInviteForm((f) => ({ ...f, password: asciiOnly(e.target.value) }))
                          }
                          className={`${inputClass} pr-11 pl-12`}
                          placeholder="אופציונלי — אם ריק, יישלח קישור הזמנה"
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
                          onClick={() => setShowInvitePassword((v) => !v)}
                          aria-label={showInvitePassword ? "הסתר סיסמה" : "הצג סיסמה"}
                          className="absolute left-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-border/40 text-muted-foreground"
                        >
                          <Icon name={showInvitePassword ? "visibility_off" : "visibility"} size="sm" />
                        </button>
                      </div>
                      {inviteForm.password.length > 0 && inviteForm.password.length < 8 ? (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-bold">
                          הסיסמה חייבת להכיל לפחות 8 תווים
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          אם ריק — תיווצר סיסמה אוטומטית ותישלח במייל. אם מולא — העובד יוכל להתחבר מיד.
                        </p>
                      )}
                    </FormField>

                    <label className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-accent/30 cursor-pointer min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={inviteForm.sendCredentials}
                        onChange={(e) => setInviteForm((f) => ({ ...f, sendCredentials: e.target.checked }))}
                        className="w-5 h-5 rounded border-border/40 text-primary focus:ring-primary/20 accent-primary"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-bold">שלח פרטי התחברות במייל</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          העובד יקבל מייל עם שם המשתמש והסיסמה הראשונית
                        </p>
                      </div>
                    </label>
                  </>
                )}
              </div>

              {/* Role Selector */}
              <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
                <h3 className="text-base font-bold text-foreground mb-1">בחירת תפקיד</h3>
                <RoleSelector
                  value={inviteRole}
                  onChange={setInviteRole}
                  assignableRoles={assignableRoleValues}
                />
              </div>
            </div>

            {/* Invite Footer */}
            <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-start gap-2 shrink-0">
              <button
                onClick={handleInvite}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? (
                  <Icon name="hourglass_empty" size="sm" className="text-white animate-spin" />
                ) : (
                  <Icon name="person_add" size="sm" className="text-white" />
                )}
                {saving ? "יוצר..." : "צור עובד"}
              </button>
              <button
                onClick={closePanel}
                disabled={saving}
                className="btn btn-outline"
              >
                ביטול
              </button>
            </div>
          </>
        ) : loading ? (
          /* ─── LOADING ──────────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
            <p className="text-sm font-medium">טוען פרטי עובד...</p>
          </div>
        ) : notFound ? (
          /* ─── NOT FOUND ─────────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Icon name="person_off" size="xl" className="opacity-30" />
            <p className="text-lg font-medium">עובד לא נמצא</p>
            <p className="text-sm">ייתכן שהעובד הוסר או שהקישור שגוי</p>
            <button
              onClick={closePanel}
              className="btn btn-outline"
            >
              סגור
            </button>
          </div>
        ) : employee ? (
          /* ─── VIEW / EDIT MODE ──────────────────────────────── */
          <>
            {/* Azure-style header */}
            <div className="relative bg-[#1e40af] border-b border-[#1e40af] px-6 pt-14 pb-5 shrink-0">
              {/* Close X — SidePanel skill spec */}
              <button
                onClick={closePanel}
                className="absolute left-4 top-4 z-10 p-1.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="סגור"
              >
                <DotLottieReact
                  src="/lottie/menu-close.lottie"
                  loop={false}
                  autoplay
                  className="w-6 h-6"
                />
              </button>

              {/* SUPER ADMIN badge */}
              {employee.role === "super_admin" && (
                <span className="absolute right-6 top-4 inline-flex items-center px-2.5 py-1 rounded-md bg-white/20 text-white text-[10px] font-extrabold tracking-wider">
                  SUPER ADMIN
                </span>
              )}

              {/* Identity row — Avatar on RIGHT, name on LEFT (RTL flex) */}
              <div className="flex items-start gap-4">
                {/* Avatar — first in flex order = appears on RIGHT in RTL */}
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-white/15 text-white flex items-center justify-center font-extrabold text-xl shadow-sm">
                    {getInitials(employee.full_name)}
                  </div>
                  <span className={`absolute bottom-0.5 left-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${employee.is_active ? "bg-emerald-500" : "bg-gray-300"}`} />
                </div>

                {/* Name + email + edit — second = appears on LEFT side of avatar */}
                <div className="flex-1 min-w-0 text-right">
                  <h2 className="text-xl font-extrabold text-white">{employee.full_name}</h2>
                  <p className="text-sm text-white/70 mt-0.5" dir="ltr" style={{ textAlign: "right" }}>{employee.email}</p>
                  <button
                    onClick={setEditMode}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white transition-colors"
                  >
                    <Icon name="edit" size="sm" />
                    ערוך פרופיל
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Navigation — Azure Ethos Subtle Card (Variation 3) */}
            <div className="px-6 pt-3 pb-3 shrink-0 border-b border-[#dad9e3] bg-white">
              <div className="inline-flex bg-[#f4f2fc] p-1 rounded-xl flex-wrap" dir="rtl">
                {TABS.map((tab) => {
                  const active = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setTab(tab.key)}
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
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "profile" && (
                <ProfileTab
                  employee={employee}
                  isEditing={panelMode === "edit"}
                  onEdit={setEditMode}
                  onSaved={handleSaved}
                  currentUserId={currentUserId}
                />
              )}
              {activeTab === "attendance" && (
                <AttendanceTab
                  employee={employee}
                  onSaved={handleSaved}
                />
              )}
              {activeTab === "permissions" && (
                <PermissionsTab
                  employee={employee}
                  onSaved={handleSaved}
                />
              )}
              {activeTab === "activity" && (
                <ActivityTab employeeId={employee.id} />
              )}
              {activeTab === "tasks" && (
                <TasksTab employeeId={employee.id} employeeRole={employee.role} />
              )}
              {activeTab === "hours" && (
                <HoursTab employeeId={employee.id} />
              )}
            </div>

            {/* Azure footer */}
            <div className="border-t border-[#dad9e3] px-6 py-4 bg-white shrink-0 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleFooterSave}
                disabled={
                  (panelMode !== "edit" &&
                    activeTab !== "attendance" &&
                    activeTab !== "profile") ||
                  saving
                }
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#1e40af] text-white font-bold text-sm hover:bg-[#1e3a8a] transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon name="check_circle" size="sm" />
                שמור שינויים
              </button>

              {employee.id !== currentUserId && (
                <button
                  onClick={() => setError("מחיקת רשומה אינה זמינה כעת — השתמש בהשבת עובד")}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#fecaca] text-[#b91c1c] font-bold text-sm hover:bg-[#fef2f2] transition-colors min-h-[44px]"
                >
                  <Icon name="delete" size="sm" />
                  מחק רשומה
                </button>
              )}

              {employee.id !== currentUserId && (
                <button
                  onClick={handleTogglePanelActive}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#dad9e3] text-[#6b6280] font-bold text-sm hover:bg-[#f4f2fc] transition-colors min-h-[44px]"
                >
                  <Icon name={employee.is_active ? "person_off" : "person"} size="sm" />
                  {employee.is_active ? "השבת עובד" : "הפעל עובד"}
                </button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </SidePanel>
  )
}
