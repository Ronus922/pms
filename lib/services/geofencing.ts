/**
 * Geofencing service — pure, no DB
 * ────────────────────────────────
 * Determines whether a [lat, lng] point lies inside an `AreaGeometry`.
 * Uses @turf/turf for polygon containment and great-circle distance.
 *
 * IMPORTANT: turf uses [lng, lat] internally; the project uses [lat, lng].
 * Conversion happens at this boundary only.
 */

import {
  point as turfPoint,
  polygon as turfPolygon,
  booleanPointInPolygon,
  distance as turfDistance,
} from "@turf/turf"
import type { AreaGeometry, LatLng } from "@/lib/types/attendance"

/** Convert [lat, lng] → [lng, lat] for turf. */
function toTurf([lat, lng]: LatLng): [number, number] {
  return [lng, lat]
}

/**
 * Check if a GPS coordinate lies inside an area's geometry.
 *
 * - polygon: standard point-in-polygon test (winding-rule).
 * - circle / point: great-circle distance ≤ radius_m.
 *
 * Returns `false` for unknown shapes (defensive — never throw).
 */
export function isPointInArea(
  lat: number,
  lng: number,
  geometry: AreaGeometry,
): boolean {
  const pt = turfPoint([lng, lat])

  if (geometry.type === "polygon") {
    if (geometry.coords.length < 3) return false
    // turf requires the first and last position to match (closed ring).
    const ring = geometry.coords.map(toTurf)
    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]])
    }
    try {
      const poly = turfPolygon([ring])
      return booleanPointInPolygon(pt, poly)
    } catch {
      return false
    }
  }

  if (geometry.type === "circle" || geometry.type === "point") {
    const center = turfPoint(toTurf(geometry.center))
    const meters = turfDistance(pt, center, { units: "meters" })
    return meters <= geometry.radius_m
  }

  return false
}

/**
 * Convenience: returns the distance in meters between a point and an area's
 * center (for circle/point) or the closest geometric center for polygons.
 * Used for "you are X meters away" UX hints. Returns `null` for invalid shapes.
 */
export function distanceToAreaCenter(
  lat: number,
  lng: number,
  geometry: AreaGeometry,
): number | null {
  const pt = turfPoint([lng, lat])

  if (geometry.type === "circle" || geometry.type === "point") {
    return turfDistance(pt, turfPoint(toTurf(geometry.center)), {
      units: "meters",
    })
  }

  if (geometry.type === "polygon") {
    if (geometry.coords.length === 0) return null
    let sumLat = 0
    let sumLng = 0
    for (const [la, ln] of geometry.coords) {
      sumLat += la
      sumLng += ln
    }
    const cLat = sumLat / geometry.coords.length
    const cLng = sumLng / geometry.coords.length
    return turfDistance(pt, turfPoint([cLng, cLat]), { units: "meters" })
  }

  return null
}
