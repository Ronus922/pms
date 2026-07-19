"use client"

import { Icon } from "@/components/shared/Icon"
import { ROLES, ROLE_STYLES, type Role } from "@/lib/permissions/constants"

/* ── Props ─────────────────────────────────────────────────── */

interface RoleSelectorProps {
  value: Role | null
  onChange: (role: Role) => void
  assignableRoles: Role[]
}

/* ── Component ─────────────────────────────────────────────── */

export function RoleSelector({ value, onChange, assignableRoles }: RoleSelectorProps) {
  const roles = ROLES.filter((r) => assignableRoles.includes(r.value))

  return (
    <div className="grid gap-3">
      {roles.map((r) => {
        const isSelected = value === r.value
        const style = ROLE_STYLES[r.value]
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => onChange(r.value)}
            className={`w-full flex items-center gap-4 p-4 rounded-[20px] border-2 transition-all min-h-[44px] text-right ${
              isSelected
                ? style?.accent || "border-gray-300 bg-gray-50/50"
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
              <Icon name={style?.icon || "person"} size="md" />
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
                <Icon name="check_circle" size="sm" className="text-primary-foreground" />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
