"use client"

import { Icon } from "@/components/shared/Icon"
import { SUPPLIER_STATUS_MAP, SUPPLIER_TYPE_MAP } from "@/lib/constants/suppliers"
import type { Supplier } from "@/lib/types/suppliers"

/* ── Props ─────────────────────────────────────────────────── */

interface SupplierCardProps {
  supplier: Supplier
  onClick: () => void
}

/* ── Helpers ───────────────────────────────────────────────── */

function getInitials(name: string): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0)
  return parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
}

/* ── Border color by status ───────────────────────────────── */

const STATUS_BORDER: Record<string, string> = {
  active: "border-emerald-500",
  inactive: "border-slate-400",
  archived: "border-amber-500",
}

/* ── Component ─────────────────────────────────────────────── */

export function SupplierCard({ supplier, onClick }: SupplierCardProps) {
  const statusCfg = SUPPLIER_STATUS_MAP[supplier.status]
  const typeCfg = SUPPLIER_TYPE_MAP[supplier.supplier_type]
  const borderColor = STATUS_BORDER[supplier.status] ?? "border-slate-300"

  return (
    <button
      onClick={onClick}
      className={`w-full text-right bg-card rounded-[20px] shadow-sm border border-border/20 border-r-4 ${borderColor} p-5 hover:shadow-md transition-all cursor-pointer group`}
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
          {getInitials(supplier.display_name)}
        </div>

        {/* Name + Contact */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground truncate">
              {supplier.display_name}
            </p>
            {supplier.company_name && (
              <span className="text-[10px] text-muted-foreground truncate max-sm:hidden">
                · {supplier.company_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {supplier.phone && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1" dir="ltr">
                <Icon name="phone" size="sm" className="text-muted-foreground/60" />
                {supplier.phone}
              </span>
            )}
            {supplier.email && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 max-sm:hidden" dir="ltr">
                <Icon name="email" size="sm" className="text-muted-foreground/60" />
                {supplier.email}
              </span>
            )}
          </div>
        </div>

        {/* Type Badge */}
        {typeCfg && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-muted-foreground text-[11px] font-bold max-sm:hidden">
            <Icon name={typeCfg.icon} size="sm" />
            {typeCfg.label}
          </span>
        )}

        {/* Status Badge */}
        <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${statusCfg.bg} ${statusCfg.text}`}>
          {statusCfg.label}
        </span>

        {/* Chevron */}
        <Icon
          name="chevron_left"
          size="sm"
          className="text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0"
        />
      </div>
    </button>
  )
}
