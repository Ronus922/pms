"use client"

/**
 * AreaMap — read-only display of an attendance area (or empty map).
 * ─────────────────────────────────────────────────────────────────
 * Renders a Google Map with optional geometry overlay and an optional
 * standalone marker. Used by:
 *   • the area picker preview (Part C)
 *   • the address-found preview (Part D)
 *
 * Controlled mode: `center` and `zoom` props drive the camera. User pans
 * are tracked via `onCameraChanged` so the map stays where the user left it
 * until the parent supplies a new `center`.
 */

import { useEffect, useRef, useState } from "react"
import {
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  type MapCameraChangedEvent,
} from "@vis.gl/react-google-maps"
import type { AreaGeometry, LatLng } from "@/lib/types/attendance"
import { DEFAULT_AREA_COLOR } from "@/lib/constants/attendance"

const DEFAULT_CENTER: LatLng = [32.0853, 34.7818] // Tel Aviv
const DEFAULT_ZOOM = 13
const FILL_OPACITY = 0.2
const STROKE_WEIGHT = 2

interface AreaMapProps {
  /** Optional geometry to render (polygon / circle / point). */
  geometry?: AreaGeometry | null
  /** Optional standalone marker — independent of geometry. */
  marker?: LatLng | null
  /** Map center as [lat, lng]. Defaults to Tel Aviv. */
  center?: LatLng
  /** Map zoom (1=world, 20=building). Defaults to 13. */
  zoom?: number
  /** CSS height. Defaults to 400px. */
  height?: string
  /** When true, disables panning/zooming. Defaults to false. */
  staticMap?: boolean
  /** Stroke / fill color (hex). Defaults to Azure Ethos primary. */
  color?: string
  /** Fired when the user clicks anywhere on the map. */
  onMapClick?: (lat: number, lng: number) => void
  /** Stable ID for the map instance — required by @vis.gl. */
  mapId?: string
}

/**
 * Renders the geometry overlay imperatively. We use the imperative API
 * because @vis.gl/react-google-maps doesn't ship Polygon/Circle wrappers.
 *
 * Performance: when only the radius/center of an existing circle changes
 * (e.g. user dragging RadiusSlider), we update the overlay in-place via
 * `setRadius` / `setCenter` to avoid the flash of tear-down + recreate.
 */
function GeometryLayer({
  geometry,
  color,
}: {
  geometry: AreaGeometry | null | undefined
  color: string
}) {
  const map = useMap()
  const overlayRef = useRef<google.maps.Polygon | google.maps.Circle | null>(
    null,
  )

  useEffect(() => {
    if (!map) return

    if (!geometry) {
      if (overlayRef.current) {
        overlayRef.current.setMap(null)
        overlayRef.current = null
      }
      return
    }

    const isCircleShape =
      geometry.type === "circle" || geometry.type === "point"
    const isPolygonShape = geometry.type === "polygon"

    // ── In-place update for matching shape kind ───────────────
    if (overlayRef.current instanceof google.maps.Circle && isCircleShape) {
      overlayRef.current.setCenter({
        lat: geometry.center[0],
        lng: geometry.center[1],
      })
      overlayRef.current.setRadius(geometry.radius_m)
      overlayRef.current.setOptions({ strokeColor: color, fillColor: color })
      return
    }
    if (
      overlayRef.current instanceof google.maps.Polygon &&
      isPolygonShape &&
      geometry.coords.length >= 3
    ) {
      overlayRef.current.setPaths(
        geometry.coords.map(([lat, lng]) => ({ lat, lng })),
      )
      overlayRef.current.setOptions({ strokeColor: color, fillColor: color })
      return
    }

    // ── Shape kind changed (or first creation): recreate ──────
    if (overlayRef.current) {
      overlayRef.current.setMap(null)
      overlayRef.current = null
    }

    const styleBase = {
      strokeColor: color,
      strokeWeight: STROKE_WEIGHT,
      fillColor: color,
      fillOpacity: FILL_OPACITY,
      clickable: false,
    }

    if (isPolygonShape && geometry.coords.length >= 3) {
      const overlay = new google.maps.Polygon({
        ...styleBase,
        paths: geometry.coords.map(([lat, lng]) => ({ lat, lng })),
      })
      overlay.setMap(map)
      overlayRef.current = overlay
    } else if (isCircleShape) {
      const overlay = new google.maps.Circle({
        ...styleBase,
        center: { lat: geometry.center[0], lng: geometry.center[1] },
        radius: geometry.radius_m,
      })
      overlay.setMap(map)
      overlayRef.current = overlay
    }
  }, [map, geometry, color])

  // Unmount-only cleanup (won't fire on every dep change).
  useEffect(() => {
    return () => {
      if (overlayRef.current) {
        overlayRef.current.setMap(null)
        overlayRef.current = null
      }
    }
  }, [])

  return null
}

export function AreaMap({
  geometry,
  marker,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  height = "400px",
  staticMap = false,
  color = DEFAULT_AREA_COLOR,
  onMapClick,
  mapId = "attendance-area-map",
}: AreaMapProps) {
  // Controlled-camera state. We sync from props on prop change but allow
  // the user's own pan/zoom to update local state via onCameraChanged.
  const [internalCenter, setInternalCenter] = useState({
    lat: center[0],
    lng: center[1],
  })
  const [internalZoom, setInternalZoom] = useState(zoom)
  const [lastCenterProp, setLastCenterProp] = useState<LatLng>(center)
  const [lastZoomProp, setLastZoomProp] = useState(zoom)

  // Render-phase sync: when external `center`/`zoom` prop changes (new
  // identity), pull it into internal state. Avoids cascading renders that
  // a useEffect-based sync would trigger.
  if (center !== lastCenterProp) {
    setLastCenterProp(center)
    setInternalCenter({ lat: center[0], lng: center[1] })
  }
  if (zoom !== lastZoomProp) {
    setLastZoomProp(zoom)
    setInternalZoom(zoom)
  }

  const handleCameraChange = (ev: MapCameraChangedEvent) => {
    setInternalCenter(ev.detail.center)
    setInternalZoom(ev.detail.zoom)
  }

  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-border bg-white"
      style={{ height }}
    >
      <Map
        mapId={mapId}
        center={internalCenter}
        zoom={internalZoom}
        gestureHandling={staticMap ? "none" : "greedy"}
        disableDefaultUI={false}
        clickableIcons={false}
        onCameraChanged={handleCameraChange}
        onClick={(ev) => {
          if (!onMapClick || !ev.detail.latLng) return
          onMapClick(ev.detail.latLng.lat, ev.detail.latLng.lng)
        }}
      >
        <GeometryLayer geometry={geometry ?? null} color={color} />
        {marker && (
          <AdvancedMarker position={{ lat: marker[0], lng: marker[1] }}>
            <Pin
              background={DEFAULT_AREA_COLOR}
              borderColor="#1e3a8a"
              glyphColor="#ffffff"
            />
          </AdvancedMarker>
        )}
      </Map>
    </div>
  )
}
