"use client"

/**
 * ⚠️  TEMPORARY DEV PAGE — REMOVE AFTER PART D VERIFIED  ⚠️
 * ─────────────────────────────────────────────────────────
 * Unified "create attendance area" form (Part B verification).
 *
 * Save behavior:
 *   • Validation: name (≥2), location (set via search OR map click), shape.
 *   • On success → JSON preview modal (no DB write).
 *   • Cancel → resets form.
 *
 * Part D will replace this with the production AreaFormSubPanel.
 */

import { useRef, useState } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider"
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
import type { AreaGeometry, ShapeType, LatLng } from "@/lib/types/attendance"

const DEFAULT_TLV: LatLng = [32.0853, 34.7818]

/** Display order for the radio group (differs from canonical SHAPE_TYPES). */
const SHAPE_RADIO_ORDER: ShapeType[] = ["address", "circle", "rectangle", "polygon"]

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

export default function MapsTestPage() {
  return (
    <GoogleMapsProvider>
      <CreateAreaForm />
    </GoogleMapsProvider>
  )
}

function CreateAreaForm() {
  const geocodingLib = useMapsLibrary("geocoding")

  const [name, setName] = useState("")
  const [location, setLocation] = useState<LocationState | null>(null)
  const [activeShape, setActiveShape] = useState<ShapeType | null>(null)
  const [radius, setRadius] = useState<number>(ADDRESS_RADIUS_DEFAULT)
  const [errors, setErrors] = useState<FormErrors>({})
  const [savedJson, setSavedJson] = useState<string | null>(null)
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_TLV)

  /** Counter to discard stale reverse-geocode responses if user clicks rapidly. */
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
    // Clear stale address (keep lat/lng if user previously clicked the map).
    setLocation((prev) => (prev ? { ...prev, address: null } : null))
  }

  const handleMapClick = async (lat: number, lng: number) => {
    const counter = ++reverseGeocodeCounter.current
    setLocation({ lat, lng, address: null })
    if (errors.location) setErrors((e) => ({ ...e, location: undefined }))

    // Best-effort reverse geocoding — silent failure leaves address null.
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
      // Silent: UI shows "מיקום מותאם ידנית" when address is null.
    }
  }

  const handleSave = () => {
    const next: FormErrors = {}
    if (name.trim().length < 2) next.name = "שם האזור חייב להכיל לפחות 2 תווים"
    if (!location) next.location = "חובה לבחור מיקום (חיפוש או לחיצה על המפה)"
    if (!activeShape) next.shape = "חובה לבחור צורה"

    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    if (!location || !activeShape) return // TS narrow

    const geometry = buildGeometry(activeShape, location, radius)
    const payload: Record<string, unknown> = {
      name: name.trim(),
      shape_type: activeShape,
      geometry,
    }
    if (activeShape === "rectangle" || activeShape === "polygon") {
      payload._note = "ציור יבוא ב-Part D"
    }

    setSavedJson(JSON.stringify(payload, null, 2))
  }

  const handleCancel = () => {
    setName("")
    setLocation(null)
    setActiveShape(null)
    setRadius(ADDRESS_RADIUS_DEFAULT)
    setErrors({})
    setSavedJson(null)
    setMapCenter(DEFAULT_TLV)
  }

  // ── Derived ────────────────────────────────────────────────

  const showRadius = activeShape === "address" || activeShape === "circle"
  const displayGeometry: AreaGeometry | null =
    showRadius && location
      ? {
          type: "point",
          center: [location.lat, location.lng],
          radius_m: radius,
        }
      : null

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>דף בדיקה זמני</strong> — Part B smoke test. יוסר אחרי Part D.
      </div>

      <h1 className="text-2xl font-bold text-[#1c1b1f]">צור אזור דיווח</h1>

      {/* ── Row 1: Name ─────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="area-name"
          className="text-sm font-medium text-[#1c1b1f]"
        >
          שם האזור
        </label>
        <input
          id="area-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (errors.name) setErrors((s) => ({ ...s, name: undefined }))
          }}
          placeholder="לדוגמה: סניף חיפה"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "area-name-error" : undefined}
          className={[
            "min-h-[44px] rounded-xl border bg-white px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20",
            errors.name
              ? "border-red-500 focus:border-red-500"
              : "border-[#dad9e3] focus:border-[#1e40af]",
          ].join(" ")}
        />
        {errors.name && (
          <p
            id="area-name-error"
            role="alert"
            className="text-xs text-red-600"
          >
            {errors.name}
          </p>
        )}
      </div>

      {/* ── Row 2: Address search ───────────────────────── */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#1c1b1f]">כתובת</label>
        <AddressSearchBox
          onResult={handleSearchResult}
          onSearchStart={handleSearchStart}
        />
        {location?.address && (
          <p className="text-xs text-green-700">✓ {location.address}</p>
        )}
        {location && !location.address && (
          <p className="text-xs text-[#474747]">📍 מיקום מותאם ידנית</p>
        )}
        {errors.location && (
          <p role="alert" className="text-xs text-red-600">
            {errors.location}
          </p>
        )}
      </div>

      {/* ── Row 3: Shape radio ──────────────────────────── */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#1c1b1f]">
          צורת האזור
        </label>
        <fieldset>
          <legend className="sr-only">בחר צורה</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {SHAPE_RADIO_ORDER.map((shape) => (
              <label
                key={shape}
                className="flex min-h-[44px] cursor-pointer items-center gap-2 px-2"
              >
                <input
                  type="radio"
                  name="shape"
                  value={shape}
                  checked={activeShape === shape}
                  onChange={() => {
                    setActiveShape(shape)
                    if (errors.shape) {
                      setErrors((s) => ({ ...s, shape: undefined }))
                    }
                  }}
                  className="h-4 w-4 cursor-pointer accent-[#1e40af]"
                />
                <span className="text-sm text-[#1c1b1f]">
                  {SHAPE_LABELS[shape]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {errors.shape && (
          <p role="alert" className="text-xs text-red-600">
            {errors.shape}
          </p>
        )}
      </div>

      {/* ── Row 4: Map ──────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#1c1b1f]">מפה</label>
        <div className="relative">
          <AreaMap
            center={mapCenter}
            marker={location ? [location.lat, location.lng] : null}
            geometry={displayGeometry}
            height="500px"
            onMapClick={handleMapClick}
          />
          {(activeShape === "rectangle" || activeShape === "polygon") && (
            <div className="absolute right-4 top-4 z-10 max-w-[280px] rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-md backdrop-blur">
              ציור {SHAPE_LABELS[activeShape]} יבוא ב-Part D — בינתיים marker בלבד
            </div>
          )}
        </div>
        <p className="text-xs text-[#9ca3af]">
          💡 לחיצה על המפה מזיזה את ה-marker למיקום החדש.
        </p>
      </div>

      {/* ── Row 5: Radius slider (conditional) ──────────── */}
      {showRadius && (
        <div className="rounded-xl border border-[#dad9e3] bg-white p-4">
          <RadiusSlider value={radius} onChange={setRadius} />
        </div>
      )}

      {/* ── Row 6: Action buttons ───────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <button type="button" onClick={handleSave} className="btn btn-primary">
          שמור אזור
        </button>
        <button type="button" onClick={handleCancel} className="btn btn-outline">
          ביטול
        </button>
      </div>

      {/* ── JSON preview modal ──────────────────────────── */}
      {savedJson !== null && (
        <JsonPreviewModal
          json={savedJson}
          onClose={() => setSavedJson(null)}
        />
      )}
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────── */

function buildGeometry(
  shape: ShapeType,
  location: LocationState,
  radius: number,
): AreaGeometry | null {
  if (shape === "address") {
    const base = {
      type: "point" as const,
      center: [location.lat, location.lng] as LatLng,
      radius_m: radius,
    }
    return location.address ? { ...base, address: location.address } : base
  }
  if (shape === "circle") {
    return {
      type: "circle",
      center: [location.lat, location.lng],
      radius_m: radius,
    }
  }
  // rectangle / polygon — drawing pending in Part D.
  return null
}

function JsonPreviewModal({
  json,
  onClose,
}: {
  json: string
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="json-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#dad9e3] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#dad9e3] p-4">
          <h2
            id="json-preview-title"
            className="text-lg font-semibold text-[#1c1b1f]"
          >
            JSON Preview (test page — לא נשמר ל-DB)
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="rounded-lg p-2 text-[#474747] hover:bg-[#f4f2fc]"
          >
            ✕
          </button>
        </div>
        <pre
          className="flex-1 overflow-auto bg-[#f4f2fc] p-4 font-mono text-xs text-[#1c1b1f]"
          dir="ltr"
        >
          {json}
        </pre>
        <div className="flex items-center justify-end border-t border-[#dad9e3] p-4">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  )
}
