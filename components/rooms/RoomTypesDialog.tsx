"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { SidePanel } from "@/components/shared/SidePanel"
import { useTenant } from "@/lib/hooks/use-tenant"
import { useRoomTypesStore } from "@/lib/stores/room-types-store"
import {
  getRoomTypesList,
  createRoomType,
  updateRoomType,
  deleteRoomType,
} from "@/lib/actions/room-types"

interface RoomType {
  id: string
  name: string
  base_price: number
  default_occupancy: number
  extra_person_price: number
  max_occupancy: number
  max_adults: number
  max_children: number
  max_infants: number
  is_accessible: boolean
  is_active: boolean
  description: string | null
  amenities: string[]
  room_count: number
}

const EMPTY_FORM = {
  name: "",
  base_price: 0,
  default_occupancy: 2,
  extra_person_price: 0,
  max_occupancy: 2,
  max_adults: 2,
  max_children: 2,
  max_infants: 1,
  is_accessible: false,
  is_active: true,
  description: "",
  amenities: [] as string[],
}

export function RoomTypesDialog({ onSaved }: { onSaved?: () => void }) {
  const { tenantId } = useTenant()
  const { isOpen, close } = useRoomTypesStore()
  const [types, setTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [view, setView] = useState<"list" | "form">("list")

  const loadTypes = useCallback(async () => {
    setLoading(true)
    const data = await getRoomTypesList(tenantId)
    setTypes(data as unknown as RoomType[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    if (isOpen) loadTypes()
  }, [isOpen, loadTypes])

  // SidePanel handles Escape key

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError("")
    setView("form")
  }

  function openEdit(rt: RoomType) {
    setEditingId(rt.id)
    setForm({
      name: rt.name,
      base_price: Number(rt.base_price),
      default_occupancy: Number(rt.default_occupancy ?? rt.max_occupancy ?? 2),
      extra_person_price: Number(rt.extra_person_price ?? 0),
      max_occupancy: rt.max_occupancy,
      max_adults: rt.max_adults ?? 2,
      max_children: rt.max_children ?? 2,
      max_infants: rt.max_infants ?? 1,
      is_accessible: rt.is_accessible,
      is_active: rt.is_active,
      description: rt.description ?? "",
      amenities: rt.amenities ?? [],
    })
    setError("")
    setView("form")
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("שם סוג חדר חובה")
      return
    }
    setSaving(true)
    setError("")
    try {
      if (editingId) {
        await updateRoomType(editingId, tenantId, form)
      } else {
        await createRoomType(tenantId, form)
      }
      await loadTypes()
      setView("list")
      onSaved?.()
    } catch {
      setError("שגיאה בשמירה")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteRoomType(id, tenantId)
    if ("error" in result) {
      setError(result.error as string)
      return
    }
    await loadTypes()
    onSaved?.()
  }

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={() => { if (view === "form") { setView("list") } else { close() } }}
      title={view === "form" ? (editingId ? "עריכת סוג חדר" : "סוג חדר חדש") : "סוגי חדרים"}
      subtitle={view === "form" ? "הגדרות סוג החדר" : `${types.length} סוגים`}
    >
      {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
                  {error}
                </div>
              )}

              {view === "list" ? (
                <div className="space-y-3">
                  {/* Add button */}
                  <button
                    onClick={openCreate}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-[20px] text-sm font-bold text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[52px]"
                  >
                    <Icon name="add" size="sm" />
                    סוג חדר חדש
                  </button>

                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Icon name="hourglass_empty" size="xl" className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">טוען...</p>
                    </div>
                  ) : types.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Icon name="bed" size="xl" className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">אין סוגי חדרים</p>
                    </div>
                  ) : (
                    types.map((rt) => (
                      <div
                        key={rt.id}
                        className="flex items-center justify-between p-4 bg-card border border-border/40 rounded-[20px] shadow-sm border-r-4 hover:shadow-md transition-all cursor-pointer"
                        style={{ borderRightColor: rt.is_active ? "#22c55e" : "#9ca3af" }}
                        onClick={() => openEdit(rt)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{rt.name}</span>
                            {rt.is_accessible && <Icon name="accessible" size="sm" className="text-primary" />}
                            {!rt.is_active && (
                              <span className="text-[12px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">לא פעיל</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>₪{Number(rt.base_price).toLocaleString()}/לילה</span>
                            <span>עד {rt.max_occupancy} אורחים</span>
                            <span>{rt.room_count} חדרים</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(rt) }}
                            className="p-2 hover:bg-accent rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Icon name="edit" size="sm" className="text-muted-foreground" />
                          </button>
                          {rt.room_count === 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(rt.id) }}
                              className="p-2 hover:bg-red-50 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                            >
                              <Icon name="block" size="sm" className="text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Form View */
                <div className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">שם סוג חדר *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className="w-full bg-accent border border-border/40 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder="Standard, Deluxe, Suite..."
                    />
                  </div>

                  {/* Price + base occupancy */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">מחיר בסיס (₪)</label>
                      <p className="text-[10.5px] text-muted-foreground/80 leading-snug">
                        כולל אירוח של תפוסת בסיס
                      </p>
                      <input
                        type="number"
                        value={form.base_price}
                        onChange={(e) => setField("base_price", Number(e.target.value))}
                        className="w-full bg-accent border border-border/40 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">תפוסת בסיס (מחיר מלא)</label>
                      <p className="text-[10.5px] text-muted-foreground/80 leading-snug">
                        מספר האורחים הכלולים במחיר הבסיס
                      </p>
                      <input
                        type="number"
                        min={1}
                        value={form.default_occupancy}
                        onChange={(e) => setField("default_occupancy", Number(e.target.value))}
                        className="w-full bg-accent border border-border/40 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Extra-person price + max occupancy */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">תוספת לאורח נוסף (₪ ללילה)</label>
                      <p className="text-[10.5px] text-muted-foreground/80 leading-snug">
                        חיוב לכל אורח מעל תפוסת הבסיס
                      </p>
                      <input
                        type="number"
                        min={0}
                        value={form.extra_person_price}
                        onChange={(e) => setField("extra_person_price", Number(e.target.value))}
                        className="w-full bg-accent border border-border/40 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">תפוסה מקסימלית</label>
                      <p className="text-[10.5px] text-muted-foreground/80 leading-snug">
                        המספר המרבי המותר לאורחים בחדר
                      </p>
                      <input
                        type="number"
                        value={form.max_occupancy}
                        onChange={(e) => setField("max_occupancy", Number(e.target.value))}
                        className="w-full bg-accent border border-border/40 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Adults, Children, Infants */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">מבוגרים</label>
                      <input
                        type="number"
                        value={form.max_adults}
                        onChange={(e) => setField("max_adults", Number(e.target.value))}
                        className="w-full bg-accent border border-border/40 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">ילדים</label>
                      <input
                        type="number"
                        value={form.max_children}
                        onChange={(e) => setField("max_children", Number(e.target.value))}
                        className="w-full bg-accent border border-border/40 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground">תינוקות</label>
                      <input
                        type="number"
                        value={form.max_infants}
                        onChange={(e) => setField("max_infants", Number(e.target.value))}
                        className="w-full bg-accent border border-border/40 rounded-xl px-4 py-3 text-sm min-h-[48px] focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">תיאור</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      rows={3}
                      className="w-full bg-accent border border-border/40 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                      placeholder="תיאור קצר של סוג החדר..."
                    />
                  </div>

                  {/* Toggles */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.is_accessible}
                        onChange={(e) => setField("is_accessible", e.target.checked)}
                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
                      />
                      <span className="text-sm font-medium">נגיש</span>
                    </label>
                    {editingId && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) => setField("is_active", e.target.checked)}
                          className="w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
                        />
                        <span className="text-sm font-medium">פעיל</span>
                      </label>
                    )}
                  </div>
                </div>
              )}

      {/* Footer — only in form view */}
            {view === "form" && (
              <div className="shrink-0 border-t border-border/40 px-6 py-4 flex items-center justify-between">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="btn btn-primary"
                >
                  {saving ? "שומר..." : editingId ? "עדכן" : "צור סוג חדר"}
                </button>
                <button
                  onClick={() => setView("list")}
                  className="border border-border/40 text-muted-foreground px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-accent transition-colors min-h-[44px]"
                >
                  ביטול
                </button>
              </div>
            )}
    </SidePanel>
  )
}
