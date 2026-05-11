"use server"

import { db } from "@/lib/db"
import type { RoomDisplayState } from "@/lib/constants/room-display"

/**
 * What counts as an "active stay" for display purposes.
 *
 * Rationale: in this project, 'confirmed' is used as the post-creation state
 * even when the guest has physically arrived. Using only 'checked_in' caused
 * rooms with guests inside them to show as 'available' — the central bug.
 *
 * Active = any non-terminal status whose date range covers the target date.
 */
const ACTIVE_STAY_STATUSES_SQL = `('confirmed','checked_in')`

/* ── Types ──────────────────────────────────────────────── */

export interface RoomWithDerivedStatus {
  id: string
  room_number: string
  name: string | null
  manual_status: string | null
  cleaning_state: "clean" | "dirty" | "in_progress"
  display_state: RoomDisplayState
  room_type_name: string | null
  building_name: string | null
  floor_name: string | null
  max_occupancy: number | null
  notes: string | null
  current_reservation_id: string | null
  current_guest_name: string | null
  current_check_in: string | null
  current_check_out: string | null
  /** TRUE if a checkout event occurs on the target date for this room */
  checkout_today: boolean
  /** Snapshot time from the current/today's checkout (HH:MM:SS) */
  checkout_time: string | null
  /** TRUE if this room needs cleaning work (dirty/in_progress/checkout_today) */
  requires_housekeeping: boolean
  /** Assigned cleaner from any pending/in_progress task on this room */
  assigned_cleaner_id: string | null
  assigned_cleaner_name: string | null
}

/* ── Derived Status Query ───────────────────────────────── */

/**
 * Returns all rooms for a tenant with a DERIVED display_state that is the
 * single source of truth for room status across the whole app.
 *
 * Priority (highest wins):
 *  1. rooms.status = 'blocked'        → blocked           (manual admin hard)
 *  2. rooms.status = 'maintenance'    → maintenance       (manual admin hard)
 *  3. Active reservation on date      → occupied          (guest is inside — derived)
 *  4. cleaning_state = 'in_progress'  → in_progress       (cleaner working)
 *  5. cleaning_state = 'dirty'        → dirty             (persists until marked clean)
 *  6. otherwise                       → available
 *
 * "Active" = reservation.status IN ('confirmed','checked_in') AND date range covers target.
 */
export async function getRoomsWithDerivedStatus(
  tenantId: string,
  atDate?: string
): Promise<RoomWithDerivedStatus[]> {
  const dateStr = atDate ?? new Date().toISOString().slice(0, 10)

  const rows = await db.unsafe(
    `
    SELECT
      r.id,
      r.room_number,
      r.name,
      r.status AS manual_status,
      COALESCE(r.cleaning_state, 'clean') AS cleaning_state,
      rt.name AS room_type_name,
      b.name AS building_name,
      f.name AS floor_name,
      rt.max_occupancy,
      r.notes,
      active_res.reservation_id AS current_reservation_id,
      active_res.guest_name AS current_guest_name,
      active_res.check_in AS current_check_in,
      active_res.check_out AS current_check_out,
      checkout_info.has_checkout_today AS checkout_today,
      checkout_info.checkout_time,
      assigned.cleaner_user_id AS assigned_cleaner_id,
      assigned.cleaner_name AS assigned_cleaner_name,
      CASE
        WHEN r.status = 'blocked'     THEN 'blocked'
        WHEN r.status = 'maintenance' THEN 'maintenance'
        WHEN active_res.reservation_id IS NOT NULL THEN 'occupied'
        WHEN COALESCE(r.cleaning_state, 'clean') = 'in_progress' THEN 'in_progress'
        WHEN COALESCE(r.cleaning_state, 'clean') = 'dirty' THEN 'dirty'
        ELSE 'available'
      END AS display_state,
      (
        COALESCE(r.cleaning_state, 'clean') IN ('dirty','in_progress')
        OR checkout_info.has_checkout_today = true
      ) AS requires_housekeeping
    FROM rooms r
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    LEFT JOIN buildings b ON b.id = r.building_id
    LEFT JOIN floors f ON f.id = r.floor_id
    LEFT JOIN LATERAL (
      SELECT
        res.id AS reservation_id,
        g.full_name AS guest_name,
        rr.check_in,
        rr.check_out
      FROM reservation_rooms rr
      JOIN reservations res ON res.id = rr.reservation_id
      JOIN guests g ON g.id = res.guest_id
      WHERE rr.room_id = r.id
        AND res.status IN ${ACTIVE_STAY_STATUSES_SQL}
        AND rr.check_in <= $1::date
        AND rr.check_out > $1::date
      ORDER BY rr.check_in DESC
      LIMIT 1
    ) AS active_res ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        TRUE AS has_checkout_today,
        COALESCE(
          CASE WHEN res.actual_checkout_time IS NOT NULL
               THEN res.actual_checkout_time::time
               ELSE NULL END,
          res.estimated_departure_time,
          '11:00'::time
        ) AS checkout_time
      FROM reservation_rooms rr
      JOIN reservations res ON res.id = rr.reservation_id
      WHERE rr.room_id = r.id
        AND rr.check_out = $1::date
        AND res.status NOT IN ('cancelled','no_show')
      ORDER BY res.updated_at DESC
      LIMIT 1
    ) AS checkout_info ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        hk.assigned_to AS cleaner_user_id,
        u.full_name AS cleaner_name
      FROM housekeeping_tasks hk
      LEFT JOIN users u ON u.id = hk.assigned_to
      WHERE hk.room_id = r.id
        AND hk.status IN ('pending','in_progress')
      ORDER BY hk.checkout_date ASC, hk.order_index ASC
      LIMIT 1
    ) AS assigned ON TRUE
    WHERE r.tenant_id = $2 AND r.is_active = true
    ORDER BY b.sort_order NULLS LAST, f.sort_order NULLS LAST, r.room_number
    `,
    [dateStr, tenantId]
  )

  // Normalize nullable booleans that come back from pg as null
  const list = rows as unknown as Array<Partial<RoomWithDerivedStatus> & {
    checkout_today: boolean | null
    requires_housekeeping: boolean | null
  }>
  return list.map((row) => ({
    ...(row as RoomWithDerivedStatus),
    checkout_today: row.checkout_today === true,
    requires_housekeeping: row.requires_housekeeping === true,
  }))
}

/**
 * Get derived state for a single room. Used by the reservation-create flow
 * to check if a room is blockable before booking.
 */
export async function getRoomDerivedState(
  tenantId: string,
  roomId: string,
  atDate?: string
): Promise<RoomDisplayState | null> {
  const dateStr = atDate ?? new Date().toISOString().slice(0, 10)

  const [row] = await db`
    SELECT
      CASE
        WHEN r.status = 'blocked'     THEN 'blocked'
        WHEN r.status = 'maintenance' THEN 'maintenance'
        WHEN EXISTS (
          SELECT 1 FROM reservation_rooms rr
          JOIN reservations res ON res.id = rr.reservation_id
          WHERE rr.room_id = r.id
            AND res.status IN ('confirmed','checked_in')
            AND rr.check_in <= ${dateStr}::date
            AND rr.check_out > ${dateStr}::date
        ) THEN 'occupied'
        WHEN COALESCE(r.cleaning_state, 'clean') = 'in_progress' THEN 'in_progress'
        WHEN COALESCE(r.cleaning_state, 'clean') = 'dirty' THEN 'dirty'
        ELSE 'available'
      END AS display_state
    FROM rooms r
    WHERE r.id = ${roomId} AND r.tenant_id = ${tenantId}
  `

  return (row?.display_state as RoomDisplayState) ?? null
}

/**
 * NOTE — removed on 2026-04-23:
 *   setRoomManualStatus(..., "blocked" | "maintenance")
 *   blockRoomDates(...)
 *   unblockRoomDate(...)
 *
 * All three were legacy writers for the pre-date-range blocking model
 * (per-day rows keyed by block_date, plus rooms.status = "blocked" /
 * "maintenance"). They had zero UI callers at removal time. Replacement
 * lives in `lib/actions/room-blocks.ts`:
 *   - createRoomBlock / updateRoomBlock / cancelRoomBlock / deleteRoomBlock
 *   - setRoomStatus (strictly "available" | "inactive" | "out_of_order")
 *
 * If a future integration needs the old shape, build it on top of the
 * new actions rather than resurrecting these helpers — mixing per-day
 * rows and date ranges is exactly the bug that motivated the rewrite.
 */

/**
 * Flip a room's cleaning state. Called by the cleaning action layer;
 * exposed here for administrative overrides too.
 */
export async function setRoomCleaningState(
  tenantId: string,
  roomId: string,
  state: "clean" | "dirty" | "in_progress"
): Promise<{ success: boolean; error?: string }> {
  try {
    await db`
      UPDATE rooms
      SET cleaning_state = ${state}, updated_at = NOW()
      WHERE id = ${roomId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}

/* Date-scoped room blocking moved to `lib/actions/room-blocks.ts` — see
 * migration 2026-04-23. This file retains only the read helpers and the
 * cleaning-state writer. */
