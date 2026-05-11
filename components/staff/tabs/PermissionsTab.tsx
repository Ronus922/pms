"use client"

import { useState, useEffect, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { RoleSelector } from "@/components/staff/RoleSelector"
import { PermissionMatrix } from "@/components/staff/PermissionMatrix"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import {
  updateUserRole,
  updateUserPermissions,
} from "@/lib/actions/permissions"
import {
  ROLES,
  MODULES,
  DEFAULT_RECEPTIONIST,
  type Role,
  type ModulePermission,
} from "@/lib/permissions/constants"
import type { EmployeeWithPermissions } from "@/lib/types/staff"

/* ── Props ─────────────────────────────────────────────────── */

interface PermissionsTabProps {
  employee: EmployeeWithPermissions
  onSaved: () => void
}

/* ── Component ─────────────────────────────────────────────── */

export function PermissionsTab({ employee, onSaved }: PermissionsTabProps) {
  const { tenantId } = useTenant()
  const { isSuperAdmin, isAdmin } = usePermissions()

  const [role, setRole] = useState<Role>(employee.role)
  const [originalRole, setOriginalRole] = useState<Role>(employee.role)
  const [perms, setPerms] = useState<ModulePermission[]>([])
  const [originalPerms, setOriginalPerms] = useState<ModulePermission[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  /* Build full permissions array */
  const buildPerms = useCallback(() => {
    const fullPerms: ModulePermission[] = MODULES.map((mod) => {
      const existing = employee.permissions.find((p) => p.module === mod.key)
      const defaults = DEFAULT_RECEPTIONIST[mod.key] || { canView: false, canEdit: false, canDelete: false }
      return {
        module: mod.key,
        canView: existing?.canView ?? defaults.canView,
        canEdit: existing?.canEdit ?? defaults.canEdit,
        canDelete: existing?.canDelete ?? defaults.canDelete,
      }
    })
    setPerms(fullPerms)
    setOriginalPerms(JSON.parse(JSON.stringify(fullPerms)))
    setRole(employee.role)
    setOriginalRole(employee.role)
  }, [employee])

  useEffect(() => {
    buildPerms()
  }, [buildPerms])

  /* Assignable roles */
  const assignableRoleValues: Role[] = ROLES
    .filter((r) => {
      if (isSuperAdmin) return true
      if (isAdmin && (r.value === "receptionist" || r.value === "cleaner")) return true
      return false
    })
    .map((r) => r.value)

  /* Toggle permission */
  function togglePerm(module: string, field: "canView" | "canEdit" | "canDelete") {
    setPerms((prev) =>
      prev.map((p) => (p.module === module ? { ...p, [field]: !p[field] } : p))
    )
  }

  /* Has changes */
  const roleChanged = role !== originalRole
  const permsChanged = JSON.stringify(perms) !== JSON.stringify(originalPerms)
  const hasChanges = roleChanged || permsChanged

  /* Save */
  async function handleSave() {
    setSaving(true)
    setError("")

    if (roleChanged) {
      const res = await updateUserRole(employee.id, tenantId, role)
      if (!res.success) {
        setError(res.error || "שגיאה בעדכון תפקיד")
        setSaving(false)
        return
      }
    }

    if (role === "receptionist" && permsChanged) {
      const res = await updateUserPermissions(employee.id, tenantId, perms)
      if (!res.success) {
        setError(res.error || "שגיאה בעדכון הרשאות")
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Icon name="error" size="sm" className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Role Selector */}
      <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-foreground mb-4">תפקיד</h3>
        <RoleSelector
          value={role}
          onChange={setRole}
          assignableRoles={assignableRoleValues}
        />
      </div>

      {/* Permission Matrix (receptionist only) */}
      {role === "receptionist" && (
        <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4">הרשאות לפי מודול</h3>
          <PermissionMatrix
            permissions={perms}
            onToggle={togglePerm}
          />
        </div>
      )}

      {/* Full access note */}
      {role !== "receptionist" && role !== "cleaner" && (
        <div className="bg-primary/5 rounded-[20px] border border-primary/15 p-5 flex items-start gap-3">
          <Icon name="info" size="md" className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-primary">גישה מלאה</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {role === "super_admin"
                ? "סופר אדמין נהנה מגישה מלאה לכל המודולים כולל חיוב והגדרות מערכת."
                : "למנהל יש גישה תפעולית מלאה לכל המודולים, למעט חיוב."}
            </p>
          </div>
        </div>
      )}

      {/* Save Button */}
      {hasChanges && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
          >
            <Icon name="check_circle" size="sm" className="text-white" />
            {saving ? "שומר..." : "שמור שינויים"}
          </button>
          <button
            onClick={buildPerms}
            className="btn btn-outline"
          >
            ביטול
          </button>
        </div>
      )}
    </div>
  )
}
