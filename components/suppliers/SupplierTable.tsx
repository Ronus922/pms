"use client"

import { Icon } from "@/components/shared/Icon"
import { SUPPLIER_STATUS_MAP, SUPPLIER_TYPE_MAP } from "@/lib/constants/suppliers"
import type { Supplier } from "@/lib/types/suppliers"

/* ── Props ─────────────────────────────────────────────────── */

interface SupplierTableProps {
  suppliers: Supplier[]
  onSupplierClick: (s: Supplier) => void
}

/* ── Helpers ───────────────────────────────────────────────── */

function getInitials(name: string): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0)
  return parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
}

/* ── Component ─────────────────────────────────────────────── */

export function SupplierTable({ suppliers, onSupplierClick }: SupplierTableProps) {
  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Icon name="local_shipping" size="xl" className="opacity-30" />
        <p className="text-lg font-medium">לא נמצאו ספקים</p>
        <p className="text-sm">נסו לשנות את מסנני החיפוש או להוסיף ספק חדש</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden" dir="rtl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#e1e7fa]">
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">שם חברה</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">תחום פעילות</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">איש קשר</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">טלפון</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 max-md:hidden">נייד</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70 max-lg:hidden">אימייל</th>
              <th className="text-right px-5 py-4 text-xs font-bold text-foreground/70">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s, idx) => {
              const statusCfg = SUPPLIER_STATUS_MAP[s.status]
              const typeCfg = SUPPLIER_TYPE_MAP[s.supplier_type]
              const isEven = idx % 2 === 1

              return (
                <tr
                  key={s.id}
                  onClick={() => onSupplierClick(s)}
                  className={`border-b border-border/10 hover:bg-primary/5 cursor-pointer transition-colors ${isEven ? "bg-accent/40" : ""}`}
                >
                  {/* Name: icon RIGHT, name LEFT */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        {typeCfg ? (
                          <Icon name={typeCfg.icon} size="md" className="text-primary" />
                        ) : (
                          <span className="text-sm font-bold text-primary">{getInitials(s.display_name)}</span>
                        )}
                      </div>
                      <span className="font-bold text-foreground text-base">{s.display_name}</span>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-5 py-4">
                    {typeCfg && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                        {typeCfg.label}
                      </span>
                    )}
                  </td>

                  {/* Contact Person + Avatar */}
                  <td className="px-5 py-4">
                    {s.contact_person ? (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold text-muted-foreground">{getInitials(s.contact_person)}</span>
                        </div>
                        <span className="text-foreground font-medium">{s.contact_person}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Phone */}
                  <td className="px-5 py-4 text-foreground tabular-nums" dir="ltr">
                    <span className="float-right">{s.phone || "—"}</span>
                  </td>

                  {/* Mobile */}
                  <td className="px-5 py-4 text-foreground tabular-nums max-md:hidden" dir="ltr">
                    <span className="float-right">{s.mobile || "—"}</span>
                  </td>

                  {/* Email */}
                  <td className="px-5 py-4 text-foreground max-lg:hidden" dir="ltr">
                    <span className="float-right">{s.email || "—"}</span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`text-xs font-bold ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        s.status === "active" ? "bg-emerald-500" :
                        s.status === "inactive" ? "bg-slate-400" :
                        "bg-amber-500"
                      }`} />
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
