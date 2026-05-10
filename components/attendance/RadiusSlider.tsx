"use client"

/**
 * RadiusSlider — controlled slider + numeric input for area radius.
 * ──────────────────────────────────────────────────────────────────
 * Used by the address-search flow (Part B test page) and by Part D's
 * sub-panel for "address" / "circle" shape configuration.
 *
 * Behavior:
 *   • slider drag → onChange fires immediately (real-time map update)
 *   • numeric input → onChange on blur OR Enter
 *   • out-of-range input → snaps to MIN/MAX, inline error message
 *   • marker chips (50/100/200/500/1000/2000) → onChange to that value
 *
 * Layout: header (label + numeric input), slider row, marker chips,
 * tooltip line. RTL-friendly text, LTR-anchored slider scale.
 */

import { useState } from "react"
import {
  ADDRESS_RADIUS_DEFAULT,
  ADDRESS_RADIUS_MIN,
  ADDRESS_RADIUS_MAX,
} from "@/lib/constants/attendance"

const QUICK_MARKERS = [50, 100, 200, 500, 1000, 2000] as const
const STEP = 10

interface RadiusSliderProps {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  /** Optional id for label association. */
  id?: string
}

export function RadiusSlider({
  value,
  onChange,
  disabled = false,
  id = "radius-slider",
}: RadiusSliderProps) {
  const [draft, setDraft] = useState<string>(String(value))
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedValue, setLastSyncedValue] = useState<number>(value)

  // Render-phase sync: when `value` changes externally (slider drag,
  // marker click, parent), pull it into the draft. Avoids the cascading-
  // render pitfall of doing this inside useEffect.
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value)
    setDraft(String(value))
    setError(null)
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value)
    setError(null)
  }

  const commitInput = () => {
    const trimmed = draft.trim()
    if (trimmed === "") {
      setDraft(String(value))
      return
    }
    const n = Number.parseInt(trimmed, 10)
    if (Number.isNaN(n)) {
      setError("ערך לא תקין")
      setDraft(String(value))
      return
    }
    if (n < ADDRESS_RADIUS_MIN) {
      setError(`הוצמד למינימום ${ADDRESS_RADIUS_MIN} מ׳`)
      onChange(ADDRESS_RADIUS_MIN)
      return
    }
    if (n > ADDRESS_RADIUS_MAX) {
      setError(`הוצמד למקסימום ${ADDRESS_RADIUS_MAX} מ׳`)
      onChange(ADDRESS_RADIUS_MAX)
      return
    }
    setError(null)
    onChange(n)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header: label + numeric input */}
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-[#1c1b1f]">
          רדיוס האזור:
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={ADDRESS_RADIUS_MIN}
            max={ADDRESS_RADIUS_MAX}
            step={STEP}
            value={draft}
            onChange={handleInputChange}
            onBlur={commitInput}
            onKeyDown={handleInputKeyDown}
            disabled={disabled}
            aria-invalid={error !== null}
            aria-describedby={error ? `${id}-error` : undefined}
            className="min-h-[44px] w-24 rounded-xl border border-[#dad9e3] bg-white px-3 py-2 text-center text-sm font-semibold text-[#1c1b1f] focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 disabled:opacity-50"
          />
          <span className="text-sm text-[#474747]">מ׳</span>
        </div>
      </div>

      {/* Inline validation error */}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-red-600"
        >
          {error}
        </p>
      )}

      {/* Slider — LTR scale (universal: small left, large right) */}
      <div dir="ltr" className="flex h-11 items-center">
        <input
          id={id}
          type="range"
          min={ADDRESS_RADIUS_MIN}
          max={ADDRESS_RADIUS_MAX}
          step={STEP}
          value={value}
          onChange={handleSliderChange}
          disabled={disabled}
          aria-label="רדיוס האזור"
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#dad9e3] outline-none accent-[#1e40af] disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#1e40af] [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:bg-[#1e3a8a] [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#1e40af]"
        />
      </div>

      {/* Quick markers — LTR row */}
      <div dir="ltr" className="flex items-center justify-between gap-1">
        {QUICK_MARKERS.map((m) => {
          const isActive = value === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              disabled={disabled}
              className={[
                "min-h-[44px] rounded-lg px-3 py-2 text-xs transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isActive
                  ? "bg-[#1e40af] font-semibold text-white"
                  : "bg-[#f4f2fc] font-medium text-[#474747] hover:text-[#1e40af]",
              ].join(" ")}
            >
              {m >= 1000 ? `${m / 1000}km` : `${m}m`}
            </button>
          )
        })}
      </div>

      {/* Default-value hint */}
      <p className="text-xs text-[#9ca3af]">
        💡 ברירת מחדל: {ADDRESS_RADIUS_DEFAULT} מ׳. מתאים למקום עם דיוק GPS סביר.
      </p>
    </div>
  )
}
