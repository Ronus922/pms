"use client"

import { createContext, useContext } from "react"
import type { Role, ModulePermission } from "@/lib/permissions/constants"
import { hasPermission } from "@/lib/permissions/check"

interface TenantContext {
  tenantId: string
  propertyId: string
  userId: string
  role: Role
  permissions: ModulePermission[]
}

const TenantCtx = createContext<TenantContext | null>(null)

export function TenantProvider({
  tenantId,
  propertyId,
  userId,
  role,
  permissions,
  children,
}: TenantContext & { children: React.ReactNode }) {
  return (
    <TenantCtx.Provider value={{ tenantId, propertyId, userId, role, permissions }}>
      {children}
    </TenantCtx.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantCtx)
  if (!ctx) throw new Error("useTenant must be used within TenantProvider")
  return ctx
}

export function usePermissions() {
  const { role, permissions } = useTenant()

  return {
    role,
    permissions,
    can: (module: string, action: "view" | "edit" | "delete") =>
      hasPermission(role, permissions, module, action),
    isAdmin: role === "super_admin" || role === "admin",
    isSuperAdmin: role === "super_admin",
  }
}
