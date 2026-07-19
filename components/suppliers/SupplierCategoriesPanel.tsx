"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { inputClass } from "@/components/shared/FormField"
import { useTenant } from "@/lib/hooks/use-tenant"
import {
  getSupplierTypes,
  addSupplierType,
  updateSupplierType,
  deleteSupplierType,
} from "@/lib/actions/suppliers"

/* ── Types ─────────────────────────────────────────────────── */

interface SupplierTypeRow {
  id: string
  value: string
  label: string
  icon: string | null
  supplier_count: number
}

interface SupplierCategoriesPanelProps {
  isOpen: boolean
  onClose: () => void
}

/* ── Component ─────────────────────────────────────────────── */

export function SupplierCategoriesPanel({ isOpen, onClose }: SupplierCategoriesPanelProps) {
  const { tenantId, userId } = useTenant()
  const [types, setTypes] = useState<SupplierTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState("")
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")

  const loadTypes = useCallback(async () => {
    setLoading(true)
    const data = await getSupplierTypes(tenantId)
    setTypes(data)
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    if (isOpen) loadTypes()
  }, [isOpen, loadTypes])

  async function handleAdd() {
    if (!newLabel.trim()) { toast.error("חובה להזין שם תחום"); return }
    setAdding(true)
    const result = await addSupplierType(tenantId, newLabel, userId)
    setAdding(false)
    if (!result.success) { toast.error(result.error ?? "שגיאה ביצירת תחום"); return }
    toast.success("התחום נוסף בהצלחה")
    setNewLabel("")
    loadTypes()
  }

  function startEdit(t: SupplierTypeRow) {
    setEditingId(t.id)
    setEditLabel(t.label)
  }

  async function handleSaveEdit() {
    if (!editingId || !editLabel.trim()) return
    const result = await updateSupplierType(tenantId, editingId, editLabel)
    if (!result.success) { toast.error(result.error ?? "שגיאה בעדכון"); return }
    toast.success("התחום עודכן")
    setEditingId(null)
    loadTypes()
  }

  async function handleDelete(t: SupplierTypeRow) {
    if (t.supplier_count > 0) {
      toast.error("לא ניתן למחוק תחום המקושר לספקים")
      return
    }
    const result = await deleteSupplierType(tenantId, t.id)
    if (!result.success) { toast.error(result.error ?? "שגיאה במחיקה"); return }
    toast.success("התחום נמחק")
    loadTypes()
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="ניהול תחומים"
      subtitle="תחומי ספקים וקטגוריות"
    >
      <div className="space-y-5">
        {/* Type List */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">תחומים קיימים</h3>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-3">
              <Icon name="hourglass_empty" size="lg" className="opacity-30 animate-spin" />
              <p className="text-sm">טוען תחומים...</p>
            </div>
          ) : types.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-3">
              <Icon name="category" size="xl" className="opacity-20" />
              <p className="text-sm">אין תחומים</p>
            </div>
          ) : (
            <div className="space-y-2">
              {types.map((t) => (
                <div key={t.id} className="bg-accent rounded-xl p-3 flex items-center gap-3">
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon name={t.icon ?? "business"} size="sm" className="text-primary" />
                  </div>

                  {/* Name / Edit */}
                  <div className="flex-1 min-w-0">
                    {editingId === t.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingId(null) }}
                          className={`${inputClass} !min-h-[36px] !py-1.5`}
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="text-primary hover:text-primary/80 min-w-[44px] min-h-[44px] flex items-center justify-center">
                          <Icon name="check" size="sm" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center">
                          <Icon name="close" size="sm" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{t.label}</span>
                        <span className="text-[11px] text-muted-foreground">({t.supplier_count} ספקים)</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {editingId !== t.id && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(t)}
                        className="text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="ערוך"
                      >
                        <Icon name="edit" size="sm" />
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        disabled={t.supplier_count > 0}
                        className={`transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                          t.supplier_count > 0
                            ? "text-muted-foreground/30 cursor-not-allowed"
                            : "text-red-500 hover:text-red-700"
                        }`}
                        title={t.supplier_count > 0 ? "לא ניתן למחוק — יש ספקים מקושרים" : "מחק"}
                      >
                        <Icon name="delete" size="sm" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Type */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold text-foreground">הוסף תחום חדש</h3>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">שם התחום</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
                className={inputClass}
                placeholder="לדוגמה: גז, מים חמים..."
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !newLabel.trim()}
              className="btn btn-primary"
            >
              {adding ? (
                <Icon name="hourglass_empty" size="sm" className="text-primary-foreground animate-spin" />
              ) : (
                <Icon name="add" size="sm" className="text-primary-foreground" />
              )}
              {adding ? "מוסיף..." : "הוסף"}
            </button>
          </div>
        </div>
      </div>
    </SidePanel>
  )
}
