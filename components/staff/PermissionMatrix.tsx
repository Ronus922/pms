"use client"

import { Icon } from "@/components/shared/Icon"
import { MODULES, type ModulePermission } from "@/lib/permissions/constants"

/* ── Props ─────────────────────────────────────────────────── */

interface PermissionMatrixProps {
  permissions: ModulePermission[]
  onToggle: (module: string, field: "canView" | "canEdit" | "canDelete") => void
  readOnly?: boolean
}

/* ── Component ─────────────────────────────────────────────── */

export function PermissionMatrix({ permissions, onToggle, readOnly }: PermissionMatrixProps) {
  return (
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
            const perm = permissions.find((p) => p.module === mod.key)
            if (!perm) return null
            return (
              <tr
                key={mod.key}
                className="border-b border-border/10 hover:bg-accent/30 transition-colors"
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                      <Icon name={mod.icon} size="sm" className="text-muted-foreground" />
                    </div>
                    <span className="text-xs font-bold">{mod.label}</span>
                  </div>
                </td>
                {(["canView", "canEdit", "canDelete"] as const).map((field) => (
                  <td key={field} className="text-center px-3 py-3">
                    <label className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perm[field]}
                        onChange={() => onToggle(mod.key, field)}
                        disabled={readOnly}
                        className="w-5 h-5 rounded-md border-border/40 text-primary focus:ring-primary/20 cursor-pointer accent-primary disabled:opacity-50"
                      />
                    </label>
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
