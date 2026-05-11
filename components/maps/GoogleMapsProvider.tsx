"use client"

/**
 * GoogleMapsProvider — local-scope wrapper for Google Maps API loader.
 * ─────────────────────────────────────────────────────────────────
 * Mount this around any subtree that needs maps (do NOT mount globally —
 * the Maps JS bundle is heavy ~150KB and shouldn't load on screens that
 * don't need it).
 *
 * Loaded libraries (additive — none of these add billable APIs by mere
 * loading; only specific function calls are billed):
 *   • marker   — `google.maps.marker.AdvancedMarkerElement` (used by
 *                @vis.gl's <AdvancedMarker>). Without this, advanced
 *                markers silently fail to render.
 *   • drawing  — `google.maps.drawing.DrawingManager` for Part D
 *   • geometry — `computeArea`, `computeDistanceBetween` helpers
 *
 * NOT loaded:
 *   • places — Places API isn't enabled for this key (see decision §12.9.6
 *     and the user's API restrictions). Address search uses Geocoding only.
 */

import { APIProvider } from "@vis.gl/react-google-maps"

interface GoogleMapsProviderProps {
  children: React.ReactNode
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <strong className="block mb-1">שגיאת תצורה: Google Maps</strong>
        משתנה הסביבה{" "}
        <code className="rounded bg-red-100 px-1 py-0.5 text-xs">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </code>{" "}
        לא הוגדר. בדוק את <code className="rounded bg-red-100 px-1 py-0.5 text-xs">.env.local</code>.
      </div>
    )
  }

  return (
    <APIProvider
      apiKey={apiKey}
      libraries={["marker", "drawing", "geometry"]}
      language="he"
      region="IL"
    >
      {children}
    </APIProvider>
  )
}
