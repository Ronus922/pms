/**
 * Room capacity validation — single implementation used by every write path.
 *
 * CORE RULE (see project memory `project_room_capacity_pricing_core.md` §C):
 *   - ADULTS + CHILDREN consume occupancy slots.
 *   - INFANTS do NOT consume occupancy — they have their own cap via max_infants.
 *   - Per-category caps (max_adults / max_children / max_infants) are
 *     independent hard limits on their own count.
 *
 * Reservation is invalid if ANY of:
 *   adults + children > max_occupancy
 *   adults            > max_adults
 *   children          > max_children
 *   infants           > max_infants
 *
 * Returns `{ ok: true }` or `{ ok: false, reason }` with explicit Hebrew
 * violation wording per section G of the memory.
 */

export interface RoomCapacityLimits {
  max_occupancy: number
  max_adults: number | null
  max_children: number | null
  max_infants: number | null
}

export interface GuestComposition {
  adults: number
  children: number
  infants: number
}

export type CapacityCheck =
  | { ok: true }
  | {
      ok: false
      violation: "max_occupancy" | "max_adults" | "max_children" | "max_infants"
      reason: string
    }

/**
 * Seed adults count for a NEW reservation from the selected room's
 * `default_occupancy`. Fallback is 1 (safe minimum), NEVER `max_occupancy`
 * — per the initialization rule, adults must not open above the default.
 * Result is always clamped to `max_occupancy` so the initial state can
 * never violate capacity even on inconsistent room data.
 */
export function seedDefaultAdults(room: {
  default_occupancy?: number | null
  max_occupancy?: number | null
}): number {
  const maxOcc = Math.max(1, Number(room.max_occupancy) || 1)
  const rawDefault = Number(room.default_occupancy) || 0
  const seed = rawDefault > 0 ? rawDefault : 1
  return Math.max(1, Math.min(seed, maxOcc))
}

export function validateRoomCapacity(
  limits: RoomCapacityLimits,
  guests: GuestComposition,
): CapacityCheck {
  const adults = Math.max(0, Number(guests.adults) || 0)
  const children = Math.max(0, Number(guests.children) || 0)
  const infants = Math.max(0, Number(guests.infants) || 0)
  // Occupancy = adults + children ONLY. Infants are excluded on purpose.
  const occupancyLoad = adults + children

  const maxOcc = Math.max(0, Number(limits.max_occupancy) || 0)
  if (maxOcc > 0 && occupancyLoad > maxOcc) {
    return {
      ok: false,
      violation: "max_occupancy",
      reason: `החדר מאפשר עד ${maxOcc} אורחים בלבד`,
    }
  }

  if (limits.max_adults != null) {
    const n = Math.max(0, Number(limits.max_adults) || 0)
    if (adults > n) {
      return {
        ok: false,
        violation: "max_adults",
        reason: `החדר מאפשר עד ${n} מבוגרים בלבד`,
      }
    }
  }

  if (limits.max_children != null) {
    const n = Math.max(0, Number(limits.max_children) || 0)
    if (children > n) {
      return {
        ok: false,
        violation: "max_children",
        reason: `החדר מאפשר עד ${n} ילדים בלבד`,
      }
    }
  }

  // Infants are EXPLICIT-ONLY. A missing/null effective cap resolves to 0
  // (forbidden) — we never infer infant allowance from occupancy, children,
  // or room-type name. Same check runs on every write path
  // (create / update / replace / drag-move).
  const maxInfants = Math.max(0, Number(limits.max_infants ?? 0) || 0)
  if (infants > maxInfants) {
    return {
      ok: false,
      violation: "max_infants",
      reason:
        maxInfants === 0
          ? "החדר אינו מאפשר תינוקות"
          : `החדר מאפשר עד ${maxInfants} תינוקות בלבד`,
    }
  }

  return { ok: true }
}
