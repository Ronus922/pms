"use client"

/**
 * AddressSearchBox — Geocoding-based address lookup (Hebrew-friendly).
 * ─────────────────────────────────────────────────────────────────────
 * Plain "type-and-search" UI (no autocomplete — the project's API key
 * does not enable Places API). Uses the Geocoding service from the Maps
 * JavaScript library, which IS enabled.
 *
 * Returns `{ lat, lng, formatted_address }` via `onResult`.
 */

import { useState } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"

export interface GeocodeResult {
  lat: number
  lng: number
  formatted_address: string
}

interface AddressSearchBoxProps {
  onResult: (result: GeocodeResult) => void
  /** Fired when a new search begins — useful for clearing stale parent state. */
  onSearchStart?: () => void
  /** Optional placeholder. */
  placeholder?: string
  /** Optional pre-filled value. */
  initialValue?: string
}

export function AddressSearchBox({
  onResult,
  onSearchStart,
  placeholder = "חפש כתובת...",
  initialValue = "",
}: AddressSearchBoxProps) {
  const geocodingLib = useMapsLibrary("geocoding")
  const [query, setQuery] = useState(initialValue)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    setError(null)
    onSearchStart?.()

    if (!geocodingLib) {
      setError("שירות החיפוש עדיין נטען")
      return
    }
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setError("הזן כתובת בת 2 תווים לפחות")
      return
    }

    setIsLoading(true)
    try {
      const geocoder = new geocodingLib.Geocoder()
      const response = await geocoder.geocode({
        address: trimmed,
        region: "IL",
        language: "he",
      })

      const first = response.results[0]
      if (!first) {
        setError("לא נמצאה כתובת תואמת")
        return
      }

      const loc = first.geometry.location
      onResult({
        lat: loc.lat(),
        lng: loc.lng(),
        formatted_address: first.formatted_address,
      })
    } catch (err) {
      const status = (err as { code?: string })?.code
      if (status === "ZERO_RESULTS") {
        setError("לא נמצאה כתובת תואמת")
      } else if (status === "OVER_QUERY_LIMIT") {
        setError("חרגת ממכסת החיפוש. נסה שוב בעוד דקה")
      } else if (status === "REQUEST_DENIED") {
        setError("גישה נדחתה — בדוק את הגבלות מפתח Google")
      } else {
        setError(err instanceof Error ? err.message : "שגיאה בחיפוש כתובת")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      void search()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={!geocodingLib}
          className="min-h-[44px] flex-1 rounded-xl border border-[#dad9e3] bg-white px-3 py-2 text-sm text-[#1c1b1f] placeholder:text-[#9ca3af] focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 disabled:opacity-50"
          dir="rtl"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={isLoading || !geocodingLib}
          className="btn btn-primary"
        >
          {isLoading ? "מחפש..." : "חפש"}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
