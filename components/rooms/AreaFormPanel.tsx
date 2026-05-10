"use client"

import { useEffect, useState, useCallback } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass, textareaClass } from "@/components/shared/FormField"
import { NumberStepper } from "@/components/shared/NumberStepper"
import { useAreaFormStore } from "@/lib/stores/area-form-store"
import { useTenant } from "@/lib/hooks/use-tenant"
import { useLookup } from "@/lib/hooks/use-lookup"
import { getRoomFormOptions, type BuildingOption, type FloorOption } from "@/lib/actions/room-form"
import { getAreaById, createArea, updateArea } from "@/lib/actions/areas"
import { toast } from "sonner"

interface AreaFormPanelProps {
  onSaved?: () => void
}

export function AreaFormPanel({ onSaved }: AreaFormPanelProps) {
  const { tenantId, propertyId } = useTenant()
  const store = useAreaFormStore()
  const [buildings, setBuildings] = useState<BuildingOption[]>([])
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [submitError, setSubmitError] = useState("")
  const { options: areaTypeOptions, loading: areaTypesLoading } = useLookup(tenantId, "area_type")

  const isEditing = !!store.editingAreaId

  // Load building/floor options + area data on open
  useEffect(() => {
    if (!store.isOpen) return
    async function load() {
      const opts = await getRoomFormOptions(tenantId)
      setBuildings(opts.buildings)
      setFloors(opts.floors)

      if (store.editingAreaId) {
        const area = await getAreaById(tenantId, store.editingAreaId)
        if (area) {
          store.setField("name", area.name)
          store.setField("code", area.code ?? "")
          store.setField("area_type", area.area_type)
          store.setField("building_id", area.building_id ?? "")
          store.setField("floor_id", area.floor_id ?? "")
          store.setField("is_active", area.is_active)
          store.setField("cleaning_relevant", area.cleaning_relevant)
          store.setField("maintenance_relevant", area.maintenance_relevant)
          store.setField("sort_order", area.sort_order)
          store.setField("notes", area.notes ?? "")
        }
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isOpen, store.editingAreaId, tenantId])

  const filteredFloors = store.building_id
    ? floors.filter((f) => f.building_id === store.building_id)
    : floors

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {}
    if (!store.name.trim()) errors.name = "שם אזור חובה"
    if (!store.area_type) errors.area_type = "סוג אזור חובה"
    if (Object.keys(errors).length > 0) {
      for (const [k, v] of Object.entries(errors)) store.setField("errors", { ...store.errors, [k]: v })
      // Set all errors at once
      useAreaFormStore.setState({ errors })
      return false
    }
    return true
  }, [store])

  async function handleSave() {
    if (!validate()) return
    setSubmitError("")
    store.setField("isSubmitting", true)

    const input = {
      name: store.name.trim(),
      code: store.code.trim(),
      area_type: store.area_type,
      building_id: store.building_id || undefined,
      floor_id: store.floor_id || undefined,
      is_active: store.is_active,
      cleaning_relevant: store.cleaning_relevant,
      maintenance_relevant: store.maintenance_relevant,
      sort_order: store.sort_order,
      notes: store.notes.trim() || undefined,
    }

    if (isEditing && store.editingAreaId) {
      const res = await updateArea(tenantId, store.editingAreaId, input)
      store.setField("isSubmitting", false)
      if (!res.success) {
        setSubmitError(res.error ?? "שגיאה בעדכון")
        return
      }
      toast.success("האזור עודכן בהצלחה")
    } else {
      const res = await createArea(tenantId, propertyId, input)
      store.setField("isSubmitting", false)
      if (!res.success) {
        setSubmitError(res.error ?? "שגיאה ביצירה")
        return
      }
      toast.success("האזור נוצר בהצלחה")
    }

    store.close()
    onSaved?.()
  }

  return (
    <SidePanel
      isOpen={store.isOpen}
      onClose={() => store.close()}
      title={isEditing ? "עריכת אזור" : "אזור חדש"}
      subtitle="ניהול אזור תפעולי"
      footer={
        <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-start gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={store.isSubmitting}
            className="btn btn-primary"
          >
            {store.isSubmitting && <Icon name="hourglass_empty" size="sm" className="animate-spin" />}
            {isEditing ? "שמור שינויים" : "צור אזור"}
          </button>
          <button
            type="button"
            onClick={() => store.close()}
            className="btn btn-outline"
          >
            ביטול
          </button>
        </div>
      }
    >
      <div className="space-y-6" dir="rtl">
        {submitError && (
          <div className="bg-destructive/10 text-destructive text-sm font-bold rounded-xl px-4 py-3">
            {submitError}
          </div>
        )}

        {/* Section: General Details */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <h3 className="text-base font-bold text-foreground mb-1">פרטים כלליים</h3>

          <FormField label="שם אזור" required error={store.errors.name}>
            <input
              type="text"
              value={store.name}
              onChange={(e) => store.setField("name", e.target.value)}
              placeholder="לדוגמה: לובי ראשי"
              className={inputClass}
            />
          </FormField>

          <FormField label="קוד אזור">
            <input
              type="text"
              value={store.code}
              onChange={(e) => store.setField("code", e.target.value)}
              placeholder="לדוגמה: LOBBY-1"
              className={inputClass}
            />
          </FormField>

          <FormField label="סוג אזור" required error={store.errors.area_type}>
            <select
              value={store.area_type}
              onChange={(e) => store.setField("area_type", e.target.value)}
              className={selectClass}
              disabled={areaTypesLoading}
            >
              <option value="">בחר סוג אזור</option>
              {areaTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">סוגי אזורים מנוהלים מתוך ההגדרות</p>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="בניין / אגף">
              <select
                value={store.building_id}
                onChange={(e) => {
                  store.setField("building_id", e.target.value)
                  store.setField("floor_id", "")
                }}
                className={selectClass}
              >
                <option value="">ללא</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="קומה">
              <select
                value={store.floor_id}
                onChange={(e) => store.setField("floor_id", e.target.value)}
                className={selectClass}
              >
                <option value="">ללא</option>
                {filteredFloors.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        {/* Section: Operational Settings */}
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
          <h3 className="text-base font-bold text-foreground mb-1">הגדרות תפעוליות</h3>
          <div className="space-y-3">
          <ToggleField
            label="פעיל"
            description="האזור מוצג ברשימות ובמערכת"
            checked={store.is_active}
            onChange={(v) => store.setField("is_active", v)}
          />
          <ToggleField
            label="רלוונטי לניקיון"
            description="אזור זה נכלל במשימות ניקיון"
            checked={store.cleaning_relevant}
            onChange={(v) => store.setField("cleaning_relevant", v)}
          />
          <ToggleField
            label="רלוונטי לתחזוקה"
            description="ניתן לפתוח תקלות עבור אזור זה"
            checked={store.maintenance_relevant}
            onChange={(v) => store.setField("maintenance_relevant", v)}
          />
        </div>

        {/* Sort Order */}
        <NumberStepper
          label="סדר תצוגה"
          value={store.sort_order}
          onChange={(v) => store.setField("sort_order", v)}
          min={0}
          max={99}
        />

          {/* Notes */}
          <FormField label="הערות תפעוליות">
            <textarea
              value={store.notes}
              onChange={(e) => store.setField("notes", e.target.value)}
              placeholder="הערות פנימיות..."
              rows={3}
              className={textareaClass}
            />
          </FormField>
        </div>
      </div>
    </SidePanel>
  )
}

/* ── Toggle Field ─────────────────────────────────────────── */

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between bg-accent rounded-xl px-4 py-3 min-h-[44px] text-right"
    >
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <div
        className={`w-11 h-6 rounded-full relative transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "right-0.5" : "left-0.5"
          }`}
        />
      </div>
    </button>
  )
}
