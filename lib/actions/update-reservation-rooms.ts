"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"
import { validateRoomCapacity } from "@/lib/utils/room-capacity"
import { isPlausibleStay, logImplausibleDatePayload } from "@/lib/utils/date-validation"
import type { ReservationRoom } from "@/lib/stores/reservation-form-store"

/** postgres.js hands back DATE columns as JavaScript Date objects, so a
 *  plain `String(prev.check_in).slice(0, 10)` produces "Mon Apr 13" (never
 *  equal to any "YYYY-MM-DD" input). This coerces either shape to canonical
 *  ISO so the datesChanged diff is accurate — previously it was always
 *  true, which forced re-validation on every save. */
function toIsoDay(v: unknown): string {
  if (v == null || v === "") return ""
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return ""
    return v.toISOString().slice(0, 10)
  }
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

/** Internal Hebrew labels for the block_type enum — used when the availability
 *  check fails because of a room_blocks overlap. Never expose raw enum strings
 *  in admin-facing errors. */
const BLOCK_TYPE_LABEL_HE: Record<string, string> = {
  maintenance: "תחזוקה",
  manual_block: "חסימה ידנית",
  owner_use: "שימוש בעלים",
  deep_cleaning: "ניקיון יסודי",
  temporary_out_of_order: "לא תקין זמנית",
  other: "אחר",
}

export interface UpdateReservationRoomsResult {
  success: boolean
  error?: string
}

/** Dedicated per-room write path for the reservation edit flow.
 *
 *  reservation_rooms is the true source of truth for per-room data since the
 *  2026-04-21 migration (dates, composition, guest contact). This action:
 *    1. UPDATEs rows whose `id` already exists on this reservation.
 *    2. INSERTs rows whose `id` is not a real reservation_rooms UUID (the
 *       create/edit UI uses local ids like `rb_…` for fresh blocks).
 *    3. DELETEs rows that used to belong to this reservation but aren't in
 *       the incoming list anymore.
 *    4. Runs availability checks per incoming row, EXCLUDING the current
 *       reservation so that a row's own existing dates never count as a
 *       self-overlap.
 *
 *  All work happens inside a single transaction — partial writes are rolled
 *  back on any failure (e.g. one room fails availability). */
export async function updateReservationRooms(
  _tenantId: string,
  reservationId: string,
  rooms: ReservationRoom[],
): Promise<UpdateReservationRoomsResult> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  try {
    if (!reservationId || !tenantId) {
      return { success: false, error: "חסר מזהה הזמנה" }
    }

    // Reservation must keep at least one room — refuse to empty it.
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return { success: false, error: "חובה להשאיר לפחות חדר אחד בהזמנה" }
    }

    // Basic per-row validation — server is the last line of defense.
    // Plausibility (year floor + sliding window) catches the "2001" class of
    // corruption regardless of which UI entry point sent the payload.
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i]
      if (!r.roomId) {
        return { success: false, error: `חדר ${i + 1}: חובה לבחור חדר` }
      }
      if (!r.checkIn || !r.checkOut || r.checkOut <= r.checkIn) {
        return { success: false, error: `חדר ${i + 1}: תאריכים לא תקינים` }
      }
      if (!r.adults || r.adults < 1) {
        return { success: false, error: `חדר ${i + 1}: לפחות מבוגר אחד נדרש` }
      }
      const plausible = isPlausibleStay(r.checkIn, r.checkOut)
      if (!plausible.ok) {
        logImplausibleDatePayload(`updateReservationRooms/room[${i}]`, {
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          raw: { reservationId, roomId: r.roomId },
        })
        return { success: false, error: `חדר ${i + 1}: ${plausible.reason}` }
      }
    }

    // Fetch currently-persisted rows for this reservation — needed to tell
    // "update this row" apart from "insert new row" and to identify deletions.
    // We also keep room_id / check_in / check_out / adults / children /
    // infants so both the availability loop AND the capacity loop below can
    // skip re-validation on rows whose booking-critical fields did not
    // change. That avoids breaking existing reservations when an admin
    // later blocks a room or reduces its max_* — historic valid bookings
    // must not fail every save just because the room config drifted.
    const existing = await db<
      {
        id: string
        room_id: string
        check_in: string
        check_out: string
        adults: number
        children: number
        infants: number
      }[]
    >`
      SELECT id, room_id, check_in, check_out, adults, children, infants
      FROM reservation_rooms
      WHERE tenant_id = ${tenantId} AND reservation_id = ${reservationId}
    `
    const existingIds = new Set(existing.map((r) => r.id))
    const existingById = new Map(existing.map((r) => [r.id, r]))

    // Classify incoming rows.
    const toUpdate: ReservationRoom[] = []
    const toInsert: ReservationRoom[] = []
    const incomingExistingIds = new Set<string>()
    for (const r of rooms) {
      if (existingIds.has(r.id)) {
        toUpdate.push(r)
        incomingExistingIds.add(r.id)
      } else {
        toInsert.push(r)
      }
    }
    const toDelete = existing.filter((e) => !incomingExistingIds.has(e.id)).map((e) => e.id)

    // Availability + capacity check per incoming row, excluding the current
    // reservation. For UPDATEs the exclude correctly skips the row's own
    // prior booking. Capacity check uses COALESCE(rooms.*, room_types.*) —
    // same source of truth as Room Management (project_room_capacity_pricing_core.md §C).
    //
    // SKIP availability re-check when the row's booking-critical fields
    // (room_id / check_in / check_out) are identical to what's already in
    // the DB. This preserves legitimate existing bookings on rooms that
    // were later administratively blocked / put into maintenance — the
    // admin who toggled the room status knew the booking existed, and
    // forcing a re-validation on an untouched row would break every save
    // of that reservation for unrelated field changes (notes, VIP, etc.).
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i]
      const prev = existingById.get(r.id)
      const roomIdChanged = !prev || prev.room_id !== r.roomId
      // Compare via toIsoDay — prev.check_in is a Date object from pg, so
      // a naive `String(...).slice(0, 10)` NEVER matches the client's ISO
      // string. That previously forced availability re-checks every save
      // (causing "room blocked" errors on unrelated edits).
      const datesChanged = !prev ||
        toIsoDay(prev.check_in) !== r.checkIn ||
        toIsoDay(prev.check_out) !== r.checkOut
      const needsAvailCheck = roomIdChanged || datesChanged

      if (needsAvailCheck) {
        // Room-status pre-check — differentiate "blocked" / "maintenance"
        // from "dates taken" so the admin sees the real reason.
        const [rm] = await db<
          { room_number: string; status: string; is_active: boolean }[]
        >`
          SELECT room_number, status, is_active
          FROM rooms
          WHERE id = ${r.roomId} AND tenant_id = ${tenantId}
        `
        if (!rm) {
          return { success: false, error: `חדר ${i + 1}: לא נמצא במערכת` }
        }
        const rnum = rm.room_number || String(i + 1)
        if (!rm.is_active) {
          return { success: false, error: `חדר ${rnum} לא פעיל — בחר חדר אחר` }
        }
        if (rm.status === "blocked") {
          return { success: false, error: `חדר ${rnum} חסום לתפעול — בחר חדר אחר` }
        }
        if (rm.status === "maintenance") {
          return { success: false, error: `חדר ${rnum} בתחזוקה — בחר חדר אחר` }
        }
        if (rm.status === "unavailable") {
          return { success: false, error: `חדר ${rnum} לא זמין — בחר חדר אחר` }
        }

        const [avail] = await db<{ ok: boolean }[]>`
          SELECT check_room_availability(
            ${tenantId}::uuid, ${r.roomId}::uuid,
            ${r.checkIn}::date, ${r.checkOut}::date,
            ${reservationId}::uuid
          ) as ok
        `
        if (!avail?.ok) {
          // Explain *why* the room isn't available. rooms.status is already
          // known-good here; rejection must come from either an active
          // room_block or another reservation's dates. Query both so the
          // admin sees a precise cause (date range + reason) instead of
          // the generic "unavailable" string.
          const [blockHit] = await db<
            { start_date: string; end_date: string; block_type: string }[]
          >`
            SELECT start_date::text AS start_date, end_date::text AS end_date, block_type
            FROM room_blocks
            WHERE tenant_id = ${tenantId}::uuid
              AND room_id = ${r.roomId}::uuid
              AND is_active = TRUE
              AND start_date < ${r.checkOut}::date
              AND end_date   > ${r.checkIn}::date
            LIMIT 1
          `
          if (blockHit) {
            const typeLabel = BLOCK_TYPE_LABEL_HE[blockHit.block_type] || blockHit.block_type
            return {
              success: false,
              error: `חדר ${rnum} חסום (${typeLabel}) בתאריכים ${blockHit.start_date} — ${blockHit.end_date}`,
            }
          }
          const [resHit] = await db<{ check_in: string; check_out: string }[]>`
            SELECT rr.check_in::text AS check_in, rr.check_out::text AS check_out
            FROM reservation_rooms rr
            JOIN reservations res ON res.id = rr.reservation_id
            WHERE rr.room_id = ${r.roomId}::uuid
              AND res.tenant_id = ${tenantId}::uuid
              AND res.status IN ('confirmed', 'checked_in')
              AND res.id != ${reservationId}::uuid
              AND rr.check_in  < ${r.checkOut}::date
              AND rr.check_out > ${r.checkIn}::date
            LIMIT 1
          `
          if (resHit) {
            return {
              success: false,
              error: `חדר ${rnum} מוזמן ע״י הזמנה אחרת בתאריכים ${resHit.check_in} — ${resHit.check_out}`,
            }
          }
          return { success: false, error: `חדר ${rnum} לא זמין בתאריכים שנבחרו` }
        }
      }

      // Capacity re-validation MUST skip when composition + room are
      // unchanged vs DB. Status-only edits (payment_status, notes, VIP, …)
      // used to fail here because a stored composition that predates a
      // later room max_occupancy reduction would always flunk on every
      // save — even though the reservation itself was never re-configured.
      // Only re-check when the admin actually changed guests OR swapped
      // the room (different max_* limits apply).
      const compositionChanged = !prev ||
        (Number(prev.adults) || 0) !== (Number(r.adults) || 0) ||
        (Number(prev.children) || 0) !== (Number(r.children) || 0) ||
        (Number(prev.infants) || 0) !== (Number(r.infants) || 0)
      const needsCapacityCheck = roomIdChanged || compositionChanged

      if (needsCapacityCheck) {
        const [caps] = await db<
          {
            max_occupancy: number | null
            max_adults: number | null
            max_children: number | null
            max_infants: number | null
          }[]
        >`
          SELECT
            COALESCE(rm.max_occupancy, rt.max_occupancy) AS max_occupancy,
            COALESCE(rm.max_adults,    rt.max_adults)    AS max_adults,
            COALESCE(rm.max_children,  rt.max_children)  AS max_children,
            COALESCE(rm.max_infants,   rt.max_infants)   AS max_infants
          FROM rooms rm
          LEFT JOIN room_types rt ON rt.id = rm.room_type_id
          WHERE rm.id = ${r.roomId} AND rm.tenant_id = ${tenantId}
        `
        if (caps?.max_occupancy != null) {
          const check = validateRoomCapacity(
            {
              max_occupancy: caps.max_occupancy,
              max_adults: caps.max_adults,
              max_children: caps.max_children,
              max_infants: caps.max_infants,
            },
            {
              adults: r.adults,
              children: r.children,
              infants: r.infants,
            },
          )
          if (!check.ok) {
            return { success: false, error: `חדר ${i + 1}: ${check.reason}` }
          }
        }
      }
    }

    // Transactional writes — UPDATE existing, INSERT new, DELETE removed.
    await db.begin(async (tx) => {
      for (const r of toUpdate) {
        await tx`
          UPDATE reservation_rooms SET
            room_id = ${r.roomId},
            check_in = ${r.checkIn}::date,
            check_out = ${r.checkOut}::date,
            rate_per_night = ${r.ratePerNight},
            adults = ${r.adults},
            children = ${r.children},
            infants = ${r.infants},
            guest_first_name = ${r.guestFirstName || null},
            guest_last_name = ${r.guestLastName || null},
            guest_phone = ${r.guestPhone || null},
            guest_email = ${r.guestEmail || null},
            guest_id_number = ${r.guestIdNumber || null},
            updated_at = NOW()
          WHERE id = ${r.id}
            AND tenant_id = ${tenantId}
            AND reservation_id = ${reservationId}
        `
      }

      for (const r of toInsert) {
        await tx`
          INSERT INTO reservation_rooms (
            tenant_id, reservation_id, room_id,
            check_in, check_out, rate_per_night,
            adults, children, infants,
            guest_first_name, guest_last_name, guest_phone, guest_email, guest_id_number
          )
          VALUES (
            ${tenantId}, ${reservationId}, ${r.roomId},
            ${r.checkIn}::date, ${r.checkOut}::date, ${r.ratePerNight},
            ${r.adults}, ${r.children}, ${r.infants},
            ${r.guestFirstName || null}, ${r.guestLastName || null},
            ${r.guestPhone || null}, ${r.guestEmail || null}, ${r.guestIdNumber || null}
          )
        `
      }

      if (toDelete.length > 0) {
        await tx`
          DELETE FROM reservation_rooms
          WHERE tenant_id = ${tenantId}
            AND reservation_id = ${reservationId}
            AND id = ANY(${toDelete})
        `
      }

      /* Keep the denormalized reservation-level aggregates in sync so legacy
       * reports / summary queries remain correct. reservation_rooms is the
       * source of truth — these are derived. */
      const minCheckIn = rooms.reduce<string>((m, r) => !m || r.checkIn < m ? r.checkIn : m, "")
      const maxCheckOut = rooms.reduce<string>((m, r) => !m || r.checkOut > m ? r.checkOut : m, "")
      const totalAdults = rooms.reduce((s, r) => s + (r.adults || 0), 0)
      const totalChildren = rooms.reduce((s, r) => s + (r.children || 0), 0)
      const totalInfants = rooms.reduce((s, r) => s + (r.infants || 0), 0)

      if (minCheckIn && maxCheckOut) {
        await tx`
          UPDATE reservations SET
            check_in = ${minCheckIn}::date,
            check_out = ${maxCheckOut}::date,
            adults = ${Math.max(1, totalAdults)},
            children = ${totalChildren},
            infants = ${totalInfants},
            updated_at = NOW()
          WHERE id = ${reservationId} AND tenant_id = ${tenantId}
        `
      }
    })

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "שגיאה בעדכון חדרי ההזמנה"
    return { success: false, error: msg }
  }
}
