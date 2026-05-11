"use client"

import { useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import type { LookupItem, LookupCategoryId, LookupItemInput } from "@/lib/types/lookup"
import {
  createLookupItem,
  updateLookupItem,
  toggleLookupItem,
  deleteLookupItem,
} from "@/lib/actions/settings"

/* ── Types ──────────────────────────────────────────────── */

interface LookupTableProps {
  tenantId: string
  category: LookupCategoryId
  items: LookupItem[]
  onReload: () => void
  showColor?: boolean
  showIcon?: boolean
}

interface FormState {
  mode: "add" | "edit"
  id?: string
  value: string
  label: string
  color: string
  icon: string
}

const EMPTY_FORM: FormState = { mode: "add", value: "", label: "", color: "", icon: "" }

/* ── Component ──────────────────────────────────────────── */

export function LookupTable({
  tenantId,
  category,
  items,
  onReload,
  showColor = true,
  showIcon = true,
}: LookupTableProps) {
  const [search, setSearch] = useState("")
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  /* ── Filtered items ─────────────────────────────────────── */
  const filtered = items.filter(
    (i) =>
      i.value.toLowerCase().includes(search.toLowerCase()) ||
      i.label.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Add / Edit ─────────────────────────────────────────── */
  const openAdd = () => setForm({ ...EMPTY_FORM })
  const openEdit = (item: LookupItem) =>
    setForm({
      mode: "edit",
      id: item.id,
      value: item.value,
      label: item.label,
      color: item.color ?? "",
      icon: item.icon ?? "",
    })
  const closeForm = () => { setForm(null); setError("") }

  const handleSave = useCallback(async () => {
    if (!form) return
    if (!form.value.trim() || !form.label.trim()) {
      setError("ערך ותווית הם שדות חובה")
      return
    }
    setSaving(true)
    setError("")

    if (form.mode === "add") {
      const input: LookupItemInput = {
        category,
        value: form.value.trim(),
        label: form.label.trim(),
        color: form.color || null,
        icon: form.icon || null,
      }
      const result = await createLookupItem(tenantId, input)
      if (!result.success) { setError(result.error ?? "שגיאה"); setSaving(false); return }
    } else if (form.id) {
      const result = await updateLookupItem(tenantId, form.id, {
        category,
        value: form.value.trim(),
        label: form.label.trim(),
        color: form.color || null,
        icon: form.icon || null,
      })
      if (!result.success) { setError(result.error ?? "שגיאה"); setSaving(false); return }
    }

    setSaving(false)
    closeForm()
    onReload()
  }, [form, tenantId, category, onReload])

  /* ── Toggle ─────────────────────────────────────────────── */
  const handleToggle = useCallback(async (itemId: string) => {
    await toggleLookupItem(tenantId, itemId)
    onReload()
  }, [tenantId, onReload])

  /* ── Delete ─────────────────────────────────────────────── */
  const handleDelete = useCallback(async (itemId: string) => {
    await deleteLookupItem(tenantId, itemId)
    setConfirmDelete(null)
    onReload()
  }, [tenantId, onReload])

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Icon
            name="search"
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש..."
            className="w-full bg-accent border border-border/40 rounded-xl pe-10 ps-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none min-h-[44px]"
          />
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="btn btn-primary"
        >
          <Icon name="add" size="sm" />
          הוסף ערך
        </button>
      </div>

      {/* ── Inline Form (Add/Edit) ──────────────────────────── */}
      {form && (
        <div className="bg-card rounded-[20px] border border-primary/20 p-5 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-foreground">
            {form.mode === "add" ? "הוספת ערך חדש" : "עריכת ערך"}
          </h4>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-800 dark:text-red-300 font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-muted-foreground">
                ערך (מזהה) <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                disabled={form.mode === "edit"}
                placeholder="direct"
                dir="ltr"
                className="w-full bg-accent border border-border/40 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[44px] disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-muted-foreground">
                תווית (תצוגה) <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="ישיר"
                className="w-full bg-accent border border-border/40 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[44px]"
              />
            </div>
            {showColor && (
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-muted-foreground">צבע</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color || "#3b82f6"}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-10 rounded-xl border border-border/40 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    placeholder="#3b82f6"
                    dir="ltr"
                    className="flex-1 bg-accent border border-border/40 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[44px]"
                  />
                </div>
              </div>
            )}
            {showIcon && (
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-muted-foreground">אייקון</label>
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="call_made"
                  dir="ltr"
                  className="w-full bg-accent border border-border/40 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[44px]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (
                <><Icon name="hourglass_empty" size="sm" className="animate-spin" /> שומר...</>
              ) : (
                <><Icon name="save" size="sm" /> שמור</>
              )}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="min-h-[44px] px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="bg-card rounded-[20px] border border-border/20 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Icon name="inbox" size="xl" className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? "לא נמצאו תוצאות" : "אין ערכים בקטגוריה זו"}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/20 bg-accent/30">
                <th className="text-right px-4 py-3 font-bold text-muted-foreground w-10">#</th>
                {showColor && <th className="text-right px-4 py-3 font-bold text-muted-foreground w-12">צבע</th>}
                {showIcon && <th className="text-right px-4 py-3 font-bold text-muted-foreground w-12">אייקון</th>}
                <th className="text-right px-4 py-3 font-bold text-muted-foreground">תווית</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground">ערך</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground w-20">פעיל</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground w-16">ברירת מחדל</th>
                <th className="text-right px-4 py-3 font-bold text-muted-foreground w-24">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`border-b border-border/10 transition-colors hover:bg-accent/30 ${
                    !item.is_active ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                  {showColor && (
                    <td className="px-4 py-3">
                      {item.color && (
                        <div
                          className="w-6 h-6 rounded-lg border border-border/30"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                    </td>
                  )}
                  {showIcon && (
                    <td className="px-4 py-3">
                      {item.icon && <Icon name={item.icon} size="sm" className="text-muted-foreground" />}
                    </td>
                  )}
                  <td className="px-4 py-3 font-bold">{item.label}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs" dir="ltr">{item.value}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggle(item.id)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label={item.is_active ? "כבה" : "הפעל"}
                    >
                      <div className={`w-10 h-6 rounded-full relative transition-colors ${item.is_active ? "bg-primary" : "bg-border/40"}`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${item.is_active ? "left-0.5" : "left-[calc(100%-1.375rem)]"}`} />
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.is_default && (
                      <Icon name="star" size="sm" className="text-amber-500" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="w-9 h-9 rounded-xl bg-accent hover:bg-border/40 flex items-center justify-center transition-colors"
                        aria-label="ערוך"
                      >
                        <Icon name="edit" size="sm" className="text-muted-foreground" />
                      </button>
                      {confirmDelete === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="w-9 h-9 rounded-xl bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors"
                            aria-label="אשר מחיקה"
                          >
                            <Icon name="check" size="sm" className="text-destructive" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="w-9 h-9 rounded-xl bg-accent hover:bg-border/40 flex items-center justify-center transition-colors"
                            aria-label="בטל"
                          >
                            <Icon name="close" size="sm" className="text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(item.id)}
                          className="w-9 h-9 rounded-xl bg-accent hover:bg-destructive/10 flex items-center justify-center transition-colors"
                          aria-label="מחק"
                        >
                          <Icon name="delete" size="sm" className="text-muted-foreground hover:text-destructive" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Summary ─────────────────────────────────────────── */}
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Icon name="info" size="sm" className="opacity-50" />
        {items.length} ערכים סה&quot;כ • {items.filter((i) => i.is_active).length} פעילים
      </p>
    </div>
  )
}
