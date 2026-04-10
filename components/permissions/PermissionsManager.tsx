"use client"

import { useEffect, useState, useCallback } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass } from "@/components/shared/FormField"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import {
  getUserWithPermissions,
  updateUserRole,
  updateUserPermissions,
  toggleUserActive,
  inviteUser,
} from "@/lib/actions/permissions"
import {
  ROLES,
  MODULES,
  DEFAULT_RECEPTIONIST,
  getRoleLabel,
  type Role,
  type ModulePermission,
} from "@/lib/permissions/constants"

/* ── Types ──────────────────────────────────────────────────── */

interface PermissionsManagerProps {
  userId: string | null
  onClose: () => void
  onSaved: () => void
}

interface UserData {
  id: string
  email: string
  full_name: string
  phone: string
  role: string
  is_active: boolean
  last_login: string | null
  created_at: string
  permissions: ModulePermission[]
}

interface InviteForm {
  fullName: string
  email: string
  phone: string
  password: string
}

/* ── Role Card Styling ──────────────────────────────────────── */

const ROLE_ICON: Record<string, string> = {
  super_admin: "crown",
  admin: "admin_panel_settings",
  receptionist: "person",
}

const ROLE_ACCENT: Record<string, string> = {
  super_admin: "border-primary bg-primary/5",
  admin: "border-[#3F51B5] bg-indigo-50/50",
  receptionist: "border-amber-400 bg-amber-50/50",
}

/* ── Component ──────────────────────────────────────────────── */

export function PermissionsManager({
  userId,
  onClose,
  onSaved,
}: PermissionsManagerProps) {
  const { tenantId, userId: currentUserId } = useTenant()
  const { isSuperAdmin, isAdmin } = usePermissions()

  const isOpen = userId !== null
  const isInvite = userId === "__invite__"

  /* ── Edit Mode State ── */
  const [user, setUser] = useState<UserData | null>(null)
  const [role, setRole] = useState<Role>("receptionist")
  const [originalRole, setOriginalRole] = useState<Role>("receptionist")
  const [perms, setPerms] = useState<ModulePermission[]>([])
  const [originalPerms, setOriginalPerms] = useState<ModulePermission[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [loadingUser, setLoadingUser] = useState(false)

  /* ── Invite Mode State ── */
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  })
  const [inviteRole, setInviteRole] = useState<Role>("receptionist")

  /* ── Load User Data (Edit Mode) ── */
  const loadUser = useCallback(async () => {
    if (!userId || isInvite) return
    setLoadingUser(true)
    setError("")
    const data = await getUserWithPermissions(userId, tenantId)
    if (data) {
      setUser(data as unknown as UserData)
      setRole(data.role as Role)
      setOriginalRole(data.role as Role)

      // Build full permissions array for all modules
      const fullPerms: ModulePermission[] = MODULES.map((mod) => {
        const existing = (data as unknown as UserData).permissions.find(
          (p) => p.module === mod.key
        )
        const defaults = DEFAULT_RECEPTIONIST[mod.key] || {
          canView: false,
          canEdit: false,
          canDelete: false,
        }
        return {
          module: mod.key,
          canView: existing?.canView ?? defaults.canView,
          canEdit: existing?.canEdit ?? defaults.canEdit,
          canDelete: existing?.canDelete ?? defaults.canDelete,
        }
      })
      setPerms(fullPerms)
      setOriginalPerms(JSON.parse(JSON.stringify(fullPerms)))
    }
    setLoadingUser(false)
  }, [userId, tenantId, isInvite])

  useEffect(() => {
    if (isOpen && !isInvite) {
      loadUser()
    }
    if (isInvite) {
      setUser(null)
      setInviteForm({ fullName: "", email: "", phone: "", password: "" })
      setInviteRole("receptionist")
      setError("")
    }
  }, [isOpen, isInvite, loadUser])

  /* ── Reset on close ── */
  useEffect(() => {
    if (!isOpen) {
      setUser(null)
      setError("")
      setSaving(false)
    }
  }, [isOpen])

  /* ── Permission Toggle Helper ── */
  function togglePerm(
    module: string,
    field: "canView" | "canEdit" | "canDelete"
  ) {
    setPerms((prev) =>
      prev.map((p) =>
        p.module === module ? { ...p, [field]: !p[field] } : p
      )
    )
  }

  /* ── Save Handler (Edit Mode) ── */
  async function handleSave() {
    if (!user) return
    setSaving(true)
    setError("")

    // Update role if changed
    if (role !== originalRole) {
      const res = await updateUserRole(user.id, tenantId, role)
      if (!res.success) {
        setError(res.error || "שגיאה בעדכון תפקיד")
        setSaving(false)
        return
      }
    }

    // Update permissions if role is receptionist and perms changed
    if (role === "receptionist") {
      const permsChanged = JSON.stringify(perms) !== JSON.stringify(originalPerms)
      if (permsChanged) {
        const res = await updateUserPermissions(user.id, tenantId, perms)
        if (!res.success) {
          setError(res.error || "שגיאה בעדכון הרשאות")
          setSaving(false)
          return
        }
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  /* ── Toggle Active Handler ── */
  async function handleToggleActive() {
    if (!user) return
    setSaving(true)
    setError("")
    const res = await toggleUserActive(user.id, tenantId, !user.is_active)
    if (!res.success) {
      setError(res.error || "שגיאה בעדכון סטטוס")
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  /* ── Invite Handler ── */
  async function handleInvite() {
    if (
      !inviteForm.fullName.trim() ||
      !inviteForm.email.trim() ||
      !inviteForm.password.trim()
    ) {
      setError("יש למלא את כל שדות החובה")
      return
    }
    setSaving(true)
    setError("")

    const res = await inviteUser(tenantId, currentUserId, {
      email: inviteForm.email.trim(),
      fullName: inviteForm.fullName.trim(),
      phone: inviteForm.phone.trim(),
      role: inviteRole,
      password: inviteForm.password,
    })

    if (!res.success) {
      setError(res.error || "שגיאה ביצירת המשתמש")
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  /* ── Determine assignable roles ── */
  const assignableRoles = ROLES.filter((r) => {
    if (isSuperAdmin) return true
    if (isAdmin && r.value === "receptionist") return true
    return false
  })

  /* ── Format date ── */
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

  /* ── Role Selector Cards (shared between edit + invite) ── */
  function RoleSelector({
    value,
    onChange,
  }: {
    value: Role
    onChange: (r: Role) => void
  }) {
    return (
      <div className="grid gap-3">
        {assignableRoles.map((r) => {
          const isSelected = value === r.value
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange(r.value)}
              className={`w-full flex items-center gap-4 p-4 rounded-[20px] border-2 transition-all min-h-[44px] text-right ${
                isSelected
                  ? ROLE_ACCENT[r.value]
                  : "border-border/20 hover:border-primary/30 bg-card"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? "bg-primary/15 text-primary"
                    : "bg-accent text-muted-foreground"
                }`}
              >
                <Icon name={ROLE_ICON[r.value]} size="md" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{r.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {r.description}
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-border/40"
                }`}
              >
                {isSelected && (
                  <Icon name="check_circle" size="sm" className="text-white" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        isInvite
          ? "הזמנת עובד חדש"
          : user?.full_name || "ניהול הרשאות"
      }
      subtitle={
        isInvite
          ? "הוספת משתמש חדש למערכת"
          : user?.email || ""
      }
    >
      <div className="-m-6 flex flex-col min-h-full">
        {/* ── Error Banner ── */}
        {error && (
          <div className="mx-6 mt-6 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <Icon name="error" size="sm" className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isInvite ? (
            /* ─── INVITE MODE ─────────────────────────────────── */
            <>
              {/* Invite Form Fields */}
              <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-foreground mb-4">
                  פרטי העובד
                </h3>

                <FormField label="שם מלא" required>
                  <input
                    type="text"
                    value={inviteForm.fullName}
                    onChange={(e) =>
                      setInviteForm((f) => ({
                        ...f,
                        fullName: e.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="שם פרטי ומשפחה"
                  />
                </FormField>

                <FormField label="אימייל" required>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm((f) => ({
                        ...f,
                        email: e.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="email@example.com"
                    dir="ltr"
                  />
                </FormField>

                <FormField label="טלפון">
                  <input
                    type="tel"
                    value={inviteForm.phone}
                    onChange={(e) =>
                      setInviteForm((f) => ({
                        ...f,
                        phone: e.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="050-0000000"
                    dir="ltr"
                  />
                </FormField>

                <FormField label="סיסמה" required>
                  <input
                    type="password"
                    value={inviteForm.password}
                    onChange={(e) =>
                      setInviteForm((f) => ({
                        ...f,
                        password: e.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="סיסמה ראשונית לעובד"
                  />
                </FormField>
              </div>

              {/* Role Selector */}
              <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4">
                  בחירת תפקיד
                </h3>
                <RoleSelector
                  value={inviteRole}
                  onChange={setInviteRole}
                />
              </div>
            </>
          ) : loadingUser ? (
            /* ─── LOADING ──────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Icon
                name="hourglass_empty"
                size="xl"
                className="opacity-30 animate-spin"
              />
              <p className="text-sm font-medium">טוען נתוני משתמש...</p>
            </div>
          ) : user ? (
            /* ─── EDIT MODE ────────────────────────────────────── */
            <>
              {/* Section 1: User Info */}
              <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4">
                  פרטי משתמש
                </h3>

                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0 text-lg">
                    {user.full_name
                      ? user.full_name
                          .split(/\s+/)
                          .map((w) => w.charAt(0))
                          .slice(0, 2)
                          .join("")
                      : "?"}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-base font-bold">{user.full_name}</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      {user.email && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Icon name="email" size="sm" className="text-muted-foreground/60" />
                          {user.email}
                        </span>
                      )}
                      {user.phone && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Icon name="phone" size="sm" className="text-muted-foreground/60" />
                          {user.phone}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                      {/* Active Toggle */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            user.is_active ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        />
                        <span className="font-bold">
                          {user.is_active ? "פעיל" : "מושבת"}
                        </span>
                      </div>

                      <span className="text-border">|</span>

                      {/* Last Login */}
                      <span className="flex items-center gap-1">
                        <Icon
                          name="clock"
                          size="sm"
                          className="text-muted-foreground/60"
                        />
                        התחברות אחרונה: {formatDate(user.last_login)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Role Selector */}
              <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4">
                  תפקיד
                </h3>
                <RoleSelector value={role} onChange={setRole} />
              </div>

              {/* Section 3: Permissions Grid (receptionist only) */}
              {role === "receptionist" && (
                <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-foreground mb-4">
                    הרשאות לפי מודול
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/20">
                          <th className="text-right text-[11px] font-bold text-muted-foreground px-3 py-3">
                            מודול
                          </th>
                          <th className="text-center text-[11px] font-bold text-muted-foreground px-3 py-3 w-20">
                            צפייה
                          </th>
                          <th className="text-center text-[11px] font-bold text-muted-foreground px-3 py-3 w-20">
                            עריכה
                          </th>
                          <th className="text-center text-[11px] font-bold text-muted-foreground px-3 py-3 w-20">
                            מחיקה
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {MODULES.map((mod) => {
                          const perm = perms.find(
                            (p) => p.module === mod.key
                          )
                          if (!perm) return null
                          return (
                            <tr
                              key={mod.key}
                              className="border-b border-border/10 hover:bg-accent/30 transition-colors"
                            >
                              {/* Module Label */}
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                                    <Icon
                                      name={mod.icon}
                                      size="sm"
                                      className="text-muted-foreground"
                                    />
                                  </div>
                                  <span className="text-xs font-bold">
                                    {mod.label}
                                  </span>
                                </div>
                              </td>

                              {/* View Checkbox */}
                              <td className="text-center px-3 py-3">
                                <label className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={perm.canView}
                                    onChange={() =>
                                      togglePerm(mod.key, "canView")
                                    }
                                    className="w-5 h-5 rounded-md border-border/40 text-primary focus:ring-primary/20 cursor-pointer accent-primary"
                                  />
                                </label>
                              </td>

                              {/* Edit Checkbox */}
                              <td className="text-center px-3 py-3">
                                <label className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={perm.canEdit}
                                    onChange={() =>
                                      togglePerm(mod.key, "canEdit")
                                    }
                                    className="w-5 h-5 rounded-md border-border/40 text-primary focus:ring-primary/20 cursor-pointer accent-primary"
                                  />
                                </label>
                              </td>

                              {/* Delete Checkbox */}
                              <td className="text-center px-3 py-3">
                                <label className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={perm.canDelete}
                                    onChange={() =>
                                      togglePerm(mod.key, "canDelete")
                                    }
                                    className="w-5 h-5 rounded-md border-border/40 text-primary focus:ring-primary/20 cursor-pointer accent-primary"
                                  />
                                </label>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Full access note for admin/super_admin */}
              {role !== "receptionist" && (
                <div className="bg-primary/5 rounded-[20px] border border-primary/15 p-5 flex items-start gap-3">
                  <Icon
                    name="info"
                    size="md"
                    className="text-primary flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-bold text-primary">
                      גישה מלאה
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {role === "super_admin"
                        ? "סופר אדמין נהנה מגישה מלאה לכל המודולים כולל חיוב והגדרות מערכת."
                        : "למנהל יש גישה תפעולית מלאה לכל המודולים, למעט חיוב."}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* ── Footer (Sticky) ── */}
        <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between gap-3 flex-wrap">
          {isInvite ? (
            /* Invite Footer */
            <>
              <button
                onClick={handleInvite}
                disabled={saving}
                className="flex items-center gap-2 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 min-h-[44px] px-8 py-3 disabled:opacity-50"
              >
                {saving ? (
                  <Icon
                    name="hourglass_empty"
                    size="sm"
                    className="text-white animate-spin"
                  />
                ) : (
                  <Icon name="send" size="sm" className="text-white" />
                )}
                {saving ? "שולח..." : "שלח הזמנה"}
              </button>
              <button
                onClick={onClose}
                disabled={saving}
                className="border border-border/30 text-muted-foreground font-bold text-sm rounded-xl hover:bg-accent transition-colors min-h-[44px] px-6 py-3"
              >
                ביטול
              </button>
            </>
          ) : user ? (
            /* Edit Footer */
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 min-h-[44px] px-8 py-3 disabled:opacity-50"
                >
                  {saving ? (
                    <Icon
                      name="hourglass_empty"
                      size="sm"
                      className="text-white animate-spin"
                    />
                  ) : (
                    <Icon name="check_circle" size="sm" className="text-white" />
                  )}
                  {saving ? "שומר..." : "שמור שינויים"}
                </button>

                <button
                  onClick={onClose}
                  disabled={saving}
                  className="border border-border/30 text-muted-foreground font-bold text-sm rounded-xl hover:bg-accent transition-colors min-h-[44px] px-6 py-3"
                >
                  ביטול
                </button>
              </div>

              {/* Disable/Enable User */}
              {user.id !== currentUserId && (
                <button
                  onClick={handleToggleActive}
                  disabled={saving}
                  className={`flex items-center gap-2 font-bold text-sm rounded-xl transition-colors min-h-[44px] px-6 py-3 ${
                    user.is_active
                      ? "text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
                      : "text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                  }`}
                >
                  <Icon
                    name={user.is_active ? "person_off" : "person"}
                    size="sm"
                  />
                  {user.is_active ? "השבת משתמש" : "הפעל משתמש"}
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </SidePanel>
  )
}
