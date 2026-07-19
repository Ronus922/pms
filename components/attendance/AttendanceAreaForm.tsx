"use client"

/**
 * AttendanceAreaForm — create or edit an attendance area.
 * ──────────────────────────────────────────────────────────
 * Iteration 1b scope:
 *   • Name / notes inputs
 *   • Address search (Geocoding) + map-click to set marker
 *   • 4 shape radios (address / circle / rectangle / polygon)
 *   • Live map with marker + circle (for address/circle shapes)
 *   • RadiusSlider (for address/circle)
 *   • Save → createAttendanceArea | updateAttendanceArea
 *
 * Out of scope (iteration 2):
 *   • Interactive drawing for rectangle / polygon — for those shapes,
 *     the Save button is disabled with an inline notice.
 */

import { useRef, useState } from "react"
import { toast } from "sonner"
import { useMapsLibrary } from "@vis.gl/react-google-maps"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, textareaClass } from "@/components/shared/FormField"
import { AreaMap } from "@/components/maps/AreaMap"
import {
  AddressSearchBox,
  type GeocodeResult,
} from "@/components/maps/AddressSearchBox"
import { RadiusSlider } from "@/components/attendance/RadiusSlider"
import {
  ADDRESS_RADIUS_DEFAULT,
  SHAPE_LABELS,
} from "@/lib/constants/attendance"
import {
  createAttendanceArea,
  updateAttendanceArea,
} from "@/lib/actions/attendance-areas"
import type {
  AreaGeometry,
  AttendanceArea,
  LatLng,
  ShapeType,
} from "@/lib/types/attendance"

const DEFAULT_TLV: LatLng = [32.0853, 34.7818]
const SHAPE_RADIO_ORDER: ShapeType[] = [
  "address",
  "circle",
  "rectangle",
  "polygon",
]

interface LocationState {
  lat: number
  lng: number
  address: string | null
}

interface FormErrors {
  name?: string
  location?: string
  shape?: string
}

interface AttendanceAreaFormProps {
  initialArea?: AttendanceArea
  onSaved: () => void
  onCancel: () => void
}

/* ── Derive initial form state from an existing area (edit mode) ───── */

function deriveInitialState(area: AttendanceArea | undefined): {
  name: string
  notes: string
  shape: ShapeType | null
  location: LocationState | null
  radius: number
} {
  if (!area) {
    return {
      name: "",
      notes: "",
      shape: null,
      location: null,
      radius: ADDRESS_RADIUS_DEFAULT,
    }
  }

  const g = area.geometry
  let center: LatLng = DEFAULT_TLV
  let radius = ADDRESS_RADIUS_DEFAULT
  let address: string | null = area.address ?? null

  if (g.type === "circle" || g.type === "point") {
    center = g.center
    radius = g.radius_m
    if (g.type === "point" && g.address) address = g.address
  } else if (g.type === "polygon" && g.coords.length > 0) {
    // Polygon has no single center — average for marker placement.
    let sumLat = 0
    let sumLng = 0
    for (const [la, ln] of g.coords) {
      sumLat += la
      sumLng += ln
    }
    center = [sumLat / g.coords.length, sumLng / g.coords.length]
  }

  return {
    name: area.name,
    notes: area.notes ?? "",
    shape: area.shape_type,
    location: { lat: center[0], lng: center[1], address },
    radius,
  }
}

export function AttendanceAreaForm({
  initialArea,
  onSaved,
  onCancel,
}: AttendanceAreaFormProps) {
  const isEdit = !!initialArea
  const initial = deriveInitialState(initialArea)

  const geocodingLib = useMapsLibrary("geocoding")

  const [name, setName] = useState(initial.name)
  const [notes, setNotes] = useState(initial.notes)
  const [shape, setShape] = useState<ShapeType | null>(initial.shape)
  const [location, setLocation] = useState<LocationState | null>(initial.location)
  const [radius, setRadius] = useState(initial.radius)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [mapCenter, setMapCenter] = useState<LatLng>(
    initial.location ? [initial.location.lat, initial.location.lng] : DEFAULT_TLV,
  )

  const reverseGeocodeCounter = useRef(0)

  // ── Handlers ───────────────────────────────────────────────

  const handleSearchResult = (result: GeocodeResult) => {
    setLocation({
      lat: result.lat,
      lng: result.lng,
      address: result.formatted_address,
    })
    setMapCenter([result.lat, result.lng])
    if (errors.location) setErrors((e) => ({ ...e, location: undefined }))
  }

  const handleSearchStart = () => {
    setLocation((prev) => (prev ? { ...prev, address: null } : null))
  }

  const handleMapClick = async (lat: number, lng: number) => {
    const counter = ++reverseGeocodeCounter.current
    setLocation({ lat, lng, address: null })
    if (errors.location) setErrors((e) => ({ ...e, location: undefined }))

    if (!geocodingLib) return
    try {
      const geocoder = new geocodingLib.Geocoder()
      const result = await geocoder.geocode({
        location: { lat, lng },
        language: "he",
        region: "IL",
      })
      const first = result.results[0]
      if (counter === reverseGeocodeCounter.current && first) {
        setLocation({ lat, lng, address: first.formatted_address })
      }
    } catch {
      // Silent — UI shows "מיקום מותאם ידנית" when address is null.
    }
  }

  const handleSetShape = (next: ShapeType) => {
    setShape(next)
    if (errors.shape) setErrors((e) => ({ ...e, shape: undefined }))
  }

  // ── Save ───────────────────────────────────────────────────

  const buildGeometry = (): AreaGeometry | null => {
    if (!location || !shape) return null
    const center: LatLng = [location.lat, location.lng]

    if (shape === "address") {
      const base = { type: "point" as const, center, radius_m: radius }
      return location.address ? { ...base, address: location.address } : base
    }
    if (shape === "circle") {
      return { type: "circle", center, radius_m: radius }
    }
    // rectangle / polygon: drawing arrives in iter 2.
    return null
  }

  const handleSave = async () => {
    const next: FormErrors = {}
    if (name.trim().length < 2) next.name = "שם האזור חייב להכיל לפחות 2 תווים"
    if (!location) next.location = "חובה לבחור מיקום (חיפוש או לחיצה על המפה)"
    if (!shape) next.shape = "חובה לבחור צורה"

    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    if (!shape || !location) return // TS narrow

    if (shape === "rectangle" || shape === "polygon") {
      const msg = `ציור ${SHAPE_LABELS[shape]} יבוא ב-iteration 2. בחר עיגול או כתובת לעת עתה.`
      toast.error(msg)
      setErrors({ shape: msg })
      return
    }

    const geometry = buildGeometry()
    if (!geometry) {
      toast.error("שגיאה פנימית: גיאומטריה לא נבנתה")
      return
    }

    setSaving(true)
    const payload = {
      name: name.trim(),
      shape_type: shape,
      geometry,
      address: location.address,
      notes: notes.trim() || null,
    }

    const res = isEdit
      ? await updateAttendanceArea("", initialArea!.id, payload)
      : await createAttendanceArea("", payload)
    setSaving(false)

    if (!res.success) {
      toast.error(res.error || "שגיאה בשמירת האזור")
      return
    }

    toast.success(isEdit ? "האזור עודכן" : "האזור נוצר")
    document.dispatchEvent(new CustomEvent("attendance-areas-changed"))
    onSaved()
  }

  // ── Derived ────────────────────────────────────────────────

  const showRadius = shape === "address" || shape === "circle"
  const displayGeometry: AreaGeometry | null =
    showRadius && location
      ? {
          type: "point",
          center: [location.lat, location.lng],
          radius_m: radius,
        }
      : null
  const drawingPlaceholder =
    shape === "rectangle"
      ? "ציור מלבן יבוא ב-iteration 2 — לעת עתה זמינים עיגול וכתובת"
      : shape === "polygon"
        ? "ציור פוליגון יבוא ב-iteration 2 — לעת עתה זמינים עיגול וכתובת"
        : null

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* Header with back-to-list */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">
          {isEdit ? `עריכת ${initialArea!.name}` : "אזור חדש"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary"
        >
          <Icon name="arrow_forward" size="sm" />
          חזור לרשימה
        </button>
      </div>

      {/* Name + notes */}
      <div className="rounded-[20px] bg-card p-5 shadow-sm border border-border/20 space-y-4">
        <FormField label="שם האזור" required error={errors.name}>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (errors.name) setErrors((s) => ({ ...s, name: undefined }))
            }}
            placeholder="לדוגמה: סניף חיפה"
            className={inputClass}
          />
        </FormField>

        <FormField label="הערות (אופציונלי)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="פרטים פנימיים — נראים רק למנהלים"
            className={textareaClass}
          />
        </FormField>
      </div>

      {/* Address search */}
      <div className="rounded-[20px] bg-card p-5 shadow-sm border border-border/20 space-y-3">
        <FormField label="כתובת" error={errors.location}>
          <AddressSearchBox
            onResult={handleSearchResult}
            onSearchStart={handleSearchStart}
          />
        </FormField>
        {location?.address && (
          <p className="text-xs text-green-700">✓ {location.address}</p>
        )}
        {location && !location.address && (
          <p className="text-xs text-muted-foreground">📍 מיקום מותאם ידנית</p>
        )}
      </div>

      {/* Shape radio — rectangle/polygon disabled until iter 2 */}
      <div className="rounded-[20px] bg-card p-5 shadow-sm border border-border/20 space-y-3">
        <FormField label="צורת האזור" required error={errors.shape}>
          <fieldset>
            <legend className="sr-only">בחר צורה</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {SHAPE_RADIO_ORDER.map((s) => {
                const isUnavailable = s === "rectangle" || s === "polygon"
                return (
                  <label
                    key={s}
                    title={
                      isUnavailable
                        ? "ציור אינטראקטיבי יבוא ב-iteration 2"
                        : undefined
                    }
                    className={[
                      "flex min-h-[44px] items-center gap-2 px-2",
                      isUnavailable
                        ? "cursor-not-allowed opacity-40"
                        : "cursor-pointer",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="area-shape"
                      value={s}
                      checked={shape === s}
                      onChange={() => handleSetShape(s)}
                      disabled={isUnavailable}
                      className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-foreground">
                      {SHAPE_LABELS[s]}
                      {isUnavailable && (
                        <span className="text-[10px] text-muted-foreground mr-1">
                          (בקרוב)
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </FormField>
      </div>

      {/* Map */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-muted-foreground mr-1">
          מפה
        </label>
        <div className="relative">
          <AreaMap
            center={mapCenter}
            marker={location ? [location.lat, location.lng] : null}
            geometry={displayGeometry}
            height="450px"
            onMapClick={handleMapClick}
          />
          {drawingPlaceholder && (
            <div className="absolute right-4 top-4 z-10 max-w-[280px] rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-md backdrop-blur">
              {drawingPlaceholder}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mr-1">
          💡 לחיצה על המפה מזיזה את ה-marker למיקום החדש.
        </p>
      </div>

      {/* Radius slider */}
      {showRadius && (
        <div className="rounded-[20px] bg-card p-5 shadow-sm border border-border/20">
          <RadiusSlider value={radius} onChange={setRadius} />
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? (
            <Icon
              name="hourglass_empty"
              size="sm"
              className="text-primary-foreground animate-spin"
            />
          ) : (
            <Icon name="check_circle" size="sm" className="text-white" />
          )}
          {saving ? "שומר..." : isEdit ? "שמור שינויים" : "צור אזור"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="btn btn-outline"
        >
          ביטול
        </button>
      </div>
    </div>
  )
}
