"use server"

/**
 * Date-range room-blocking model.
 *
 * Why this file exists:
 *  - rooms.status is reserved for long-lived lifecycle state only
 *    (available / inactive / out_of_order). Operational closures
 *    (maintenance, manual blocks, owner use, etc.) are a different
 *    concern and belong in room_blocks with a real DATE RANGE, not
 *    per-day rows. This action layer is the single write path for
 *    that table.
 *
 *  - Every mutation is gated by requireAdmin() and every read / write
 *    is tenant-scoped. rooms-status.ts still owns legacy per-day helpers
 *    that will be removed once all UI flows have migrated.
 *
 * Overlap semantics:
 *  - A block occupies [start_date, end_date) (end exclusive), matching the
 *    reservation convention and the SQL check in check_room_availability.
 *  - Two ranges overlap iff  a.start < b.end  AND  a.end > b.start.
 *  - Reservation conflicts are returned to the caller (not auto-rejected)
 *    so the UI can ask the admin whether to proceed.
 */

import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"

/* ── Types ──────────────────────────────────────────────────── */

export type RoomBlockType =
  | "maintenance"
  | "manual_block"
  | "owner_use"
  | "deep_cleaning"
  | "temporary_out_of_order"
  | "other"

export interface RoomBlockRow {
  id: string
  tenant_id: string
  room_id: string
  start_date: string
  end_date: string
  block_type: RoomBlockType
  reason: string | null
  notes: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
  room_number: string
  room_type_name: string | null
  created_by_name: string | null
}

export interface ReservationConflict {
  reservation_id: string
  reservation_number: string | null
  check_in: string
  check_out: string
  guest_name: string | null
}

export interface BlockConflict {
  id: string
  start_date: string
  end_date: string
  block_type: RoomBlockType
}

/* ── Validation helpers ─────────────────────────────────────── */

const VALID_TYPES: RoomBlockType[] = [
  "maintenance",
  "manual_block",
  "owner_use",
  "deep_cleaning",
  "temporary_out_of_order",
  "other",
]

function isValidType(v: unknown): v is RoomBlockType {
  return typeof v === "string" && (VALID_TYPES as string[]).includes(v)
}

function isValidDate(v: unknown): v is string {
  if (typeof v !== "string") return false
  return /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/* ── List ───────────────────────────────────────────────────── */

export async function listRoomBlocks(
  tenantId: string,
  opts?: { roomId?: string; includeExpired?: boolean },
): Promise<RoomBlockRow[]> {
  const roomId = opts?.roomId ?? null
  const includeExpired = opts?.includeExpired ?? true

  // Join room_number + room_type_name so the UI never needs a second
  // round-trip. Ordered by room then by start_date so admins see each
  // room's block history together.
  const rows = await db<RoomBlockRow[]>`
    SELECT
      rb.id,
      rb.tenant_id,
      rb.room_id,
      rb.start_date::text AS start_date,
      rb.end_date::text AS end_date,
      rb.block_type,
      rb.reason,
      rb.notes,
      rb.is_active,
      rb.created_by,
      rb.created_at,
      rb.updated_by,
      rb.updated_at,
      r.room_number,
      rt.name AS room_type_name,
      u.full_name AS created_by_name
    FROM room_blocks rb
    JOIN rooms r ON r.id = rb.room_id
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    LEFT JOIN users u ON u.id = rb.created_by
    WHERE rb.tenant_id = ${tenantId}
      AND (${roomId}::uuid IS NULL OR rb.room_id = ${roomId}::uuid)
      AND (${includeExpired}::boolean = TRUE OR rb.end_date > CURRENT_DATE)
    ORDER BY r.room_number, rb.start_date DESC
  `
  return rows
}

/* ── Internal conflict checks ───────────────────────────────── */

async function findOverlappingBlock(
  tenantId: string,
  roomId: string,
  startDate: string,
  endDate: string,
  excludeBlockId?: string,
): Promise<BlockConflict | null> {
  const [row] = await db<BlockConflict[]>`
    SELECT id, start_date::text AS start_date, end_date::text AS end_date, block_type
    FROM room_blocks
    WHERE tenant_id = ${tenantId}
      AND room_id = ${roomId}::uuid
      AND is_active = TRUE
      AND start_date < ${endDate}::date
      AND end_date > ${startDate}::date
      AND (${excludeBlockId ?? null}::uuid IS NULL OR id != ${excludeBlockId ?? null}::uuid)
    ORDER BY start_date
    LIMIT 1
  `
  return row ?? null
}

async function findOverlappingReservations(
  tenantId: string,
  roomId: string,
  startDate: string,
  endDate: string,
): Promise<ReservationConflict[]> {
  const rows = await db<ReservationConflict[]>`
    SELECT
      res.id AS reservation_id,
      res.reservation_number,
      rr.check_in::text AS check_in,
      rr.check_out::text AS check_out,
      g.full_name AS guest_name
    FROM reservation_rooms rr
    JOIN reservations res ON res.id = rr.reservation_id
    LEFT JOIN guests g ON g.id = res.guest_id
    WHERE rr.room_id = ${roomId}::uuid
      AND res.tenant_id = ${tenantId}
      AND res.status IN ('confirmed', 'checked_in')
      AND rr.check_in < ${endDate}::date
      AND rr.check_out > ${startDate}::date
    ORDER BY rr.check_in
  `
  return rows
}

/* ── Create ─────────────────────────────────────────────────── */

export interface CreateRoomBlockInput {
  roomId: string
  startDate: string
  endDate: string
  blockType: RoomBlockType
  reason?: string | null
  notes?: string | null
}

export interface CreateRoomBlockResult {
  success: boolean
  error?: string
  /** Populated on BOTH success (conflicts accepted + committed) and failure
   *  (needs confirmation) — the UI inspects `success` to decide whether the
   *  block committed, and renders the list either way. */
  reservationConflicts?: ReservationConflict[]
  /** Set when success=false AND the only reason was an overlapping
   *  reservation — UI shows the explicit-confirmation checkbox in this case. */
  needsConfirmation?: boolean
  data?: { id: string }
}

export async function createRoomBlock(
  tenantId: string,
  input: CreateRoomBlockInput,
  /** Admin has explicitly acknowledged the overlapping reservation(s) and
   *  wants to create the block anyway. Default FALSE — safety first. */
  acceptReservationConflicts = false,
): Promise<CreateRoomBlockResult> {
  try {
    const actor = await requireAdmin()

    if (!input.roomId) return { success: false, error: "חובה לבחור חדר" }
    if (!isValidDate(input.startDate)) return { success: false, error: "תאריך התחלה לא תקין" }
    if (!isValidDate(input.endDate)) return { success: false, error: "תאריך סיום לא תקין" }
    if (input.endDate <= input.startDate) {
      return { success: false, error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" }
    }
    if (!isValidType(input.blockType)) {
      return { success: false, error: "סוג חסימה לא תקין" }
    }

    // Tenant-scoped room ownership check.
    const [room] = await db<{ id: string }[]>`
      SELECT id FROM rooms
      WHERE id = ${input.roomId}::uuid AND tenant_id = ${tenantId}
    `
    if (!room) return { success: false, error: "חדר לא נמצא בארגון" }

    const existing = await findOverlappingBlock(
      tenantId,
      input.roomId,
      input.startDate,
      input.endDate,
    )
    if (existing) {
      return {
        success: false,
        error: `קיימת חסימה חופפת בתאריכים ${existing.start_date} — ${existing.end_date}`,
      }
    }

    // Reservation conflicts are HARD-BLOCKED by default. To commit anyway
    // the admin must re-submit with `acceptReservationConflicts=true`, which
    // the UI toggles only after showing an explicit confirmation checkbox.
    // This is a real-money guardrail — silent overbooking must not be a
    // one-click accident.
    const reservationConflicts = await findOverlappingReservations(
      tenantId,
      input.roomId,
      input.startDate,
      input.endDate,
    )
    if (reservationConflicts.length > 0 && !acceptReservationConflicts) {
      return {
        success: false,
        error: `החסימה חופפת ל-${reservationConflicts.length} הזמנה קיימת. אשר במפורש כדי להמשיך.`,
        needsConfirmation: true,
        reservationConflicts,
      }
    }

    const [inserted] = await db<{ id: string }[]>`
      INSERT INTO room_blocks (
        tenant_id, room_id,
        start_date, end_date,
        block_type, reason, notes,
        is_active,
        block_date,
        created_by, updated_by
      )
      VALUES (
        ${tenantId}, ${input.roomId}::uuid,
        ${input.startDate}::date, ${input.endDate}::date,
        ${input.blockType}, ${input.reason ?? "סגור"}, ${input.notes ?? null},
        TRUE,
        ${input.startDate}::date,
        ${actor.userId}::uuid, ${actor.userId}::uuid
      )
      RETURNING id
    `

    return {
      success: true,
      data: { id: inserted.id },
      reservationConflicts: reservationConflicts.length > 0 ? reservationConflicts : undefined,
    }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const msg = err instanceof Error ? err.message : "שגיאה ביצירת חסימה"
    return { success: false, error: msg }
  }
}

/* ── Update ─────────────────────────────────────────────────── */

export interface UpdateRoomBlockInput {
  startDate?: string
  endDate?: string
  blockType?: RoomBlockType
  reason?: string | null
  notes?: string | null
  isActive?: boolean
}

export interface UpdateRoomBlockResult {
  success: boolean
  error?: string
  reservationConflicts?: ReservationConflict[]
  needsConfirmation?: boolean
}

export async function updateRoomBlock(
  tenantId: string,
  blockId: string,
  updates: UpdateRoomBlockInput,
  /** Admin has explicitly accepted overlapping reservations for the new
   *  date range. Default FALSE — edits that widen a block over an existing
   *  booking must not silently commit. */
  acceptReservationConflicts = false,
): Promise<UpdateRoomBlockResult> {
  try {
    const actor = await requireAdmin()

    const [current] = await db<
      {
        id: string
        room_id: string
        start_date: string
        end_date: string
        block_type: RoomBlockType
      }[]
    >`
      SELECT id, room_id, start_date::text AS start_date, end_date::text AS end_date, block_type
      FROM room_blocks
      WHERE id = ${blockId}::uuid AND tenant_id = ${tenantId}
    `
    if (!current) return { success: false, error: "חסימה לא נמצאה" }

    const newStart = updates.startDate ?? current.start_date
    const newEnd = updates.endDate ?? current.end_date
    const newType = updates.blockType ?? current.block_type

    if (!isValidDate(newStart)) return { success: false, error: "תאריך התחלה לא תקין" }
    if (!isValidDate(newEnd)) return { success: false, error: "תאריך סיום לא תקין" }
    if (newEnd <= newStart) {
      return { success: false, error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה" }
    }
    if (!isValidType(newType)) {
      return { success: false, error: "סוג חסימה לא תקין" }
    }

    // Overlap vs *other* blocks on the same room.
    const overlap = await findOverlappingBlock(
      tenantId,
      current.room_id,
      newStart,
      newEnd,
      blockId,
    )
    if (overlap) {
      return {
        success: false,
        error: `קיימת חסימה חופפת בתאריכים ${overlap.start_date} — ${overlap.end_date}`,
      }
    }

    const reservationConflicts = await findOverlappingReservations(
      tenantId,
      current.room_id,
      newStart,
      newEnd,
    )
    if (reservationConflicts.length > 0 && !acceptReservationConflicts) {
      return {
        success: false,
        error: `השינוי חופף ל-${reservationConflicts.length} הזמנה קיימת. אשר במפורש כדי להמשיך.`,
        needsConfirmation: true,
        reservationConflicts,
      }
    }

    // NOTE: only write fields the caller provided. `reason` is NOT NULL in
    // the DB with default 'סגור' — if the caller passes null or empty, we
    // store the default sentinel so the constraint holds.
    const newReason =
      updates.reason === undefined
        ? null // means "leave as-is"
        : updates.reason && updates.reason.trim().length > 0
          ? updates.reason
          : "סגור"
    const newNotes = updates.notes === undefined ? null : updates.notes
    const newActive = updates.isActive === undefined ? null : updates.isActive

    await db`
      UPDATE room_blocks SET
        start_date = ${newStart}::date,
        end_date   = ${newEnd}::date,
        block_type = ${newType},
        reason     = COALESCE(${newReason}, reason),
        notes      = CASE WHEN ${updates.notes === undefined} THEN notes ELSE ${newNotes} END,
        is_active  = COALESCE(${newActive}, is_active),
        updated_by = ${actor.userId}::uuid,
        updated_at = NOW()
      WHERE id = ${blockId}::uuid AND tenant_id = ${tenantId}
    `

    return {
      success: true,
      reservationConflicts:
        reservationConflicts.length > 0 ? reservationConflicts : undefined,
    }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const msg = err instanceof Error ? err.message : "שגיאה בעדכון חסימה"
    return { success: false, error: msg }
  }
}

/* ── Cancel (soft) ──────────────────────────────────────────── */

export async function cancelRoomBlock(
  tenantId: string,
  blockId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireAdmin()
    const result = await db`
      UPDATE room_blocks
      SET is_active = FALSE,
          updated_by = ${actor.userId}::uuid,
          updated_at = NOW()
      WHERE id = ${blockId}::uuid AND tenant_id = ${tenantId}
    `
    if (result.count === 0) return { success: false, error: "חסימה לא נמצאה" }
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const msg = err instanceof Error ? err.message : "שגיאה בביטול חסימה"
    return { success: false, error: msg }
  }
}

/* ── Delete (hard) ──────────────────────────────────────────── */

export async function deleteRoomBlock(
  tenantId: string,
  blockId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const result = await db`
      DELETE FROM room_blocks
      WHERE id = ${blockId}::uuid AND tenant_id = ${tenantId}
    `
    if (result.count === 0) return { success: false, error: "חסימה לא נמצאה" }
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const msg = err instanceof Error ? err.message : "שגיאה במחיקת חסימה"
    return { success: false, error: msg }
  }
}

/* ── Room status (long-lived) ───────────────────────────────── */

export type RoomStatus = "available" | "inactive" | "out_of_order"

const VALID_ROOM_STATUSES: RoomStatus[] = ["available", "inactive", "out_of_order"]

export async function setRoomStatus(
  tenantId: string,
  roomId: string,
  status: RoomStatus,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    if (!VALID_ROOM_STATUSES.includes(status)) {
      return { success: false, error: "סטטוס לא תקין" }
    }
    const result = await db`
      UPDATE rooms
      SET status = ${status},
          updated_at = NOW()
      WHERE id = ${roomId}::uuid AND tenant_id = ${tenantId}
    `
    if (result.count === 0) return { success: false, error: "חדר לא נמצא" }
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const msg = err instanceof Error ? err.message : "שגיאה בעדכון סטטוס חדר"
    return { success: false, error: msg }
  }
}

/* ── Room list for block dialog ─────────────────────────────── */

export interface RoomForBlockSelect {
  id: string
  room_number: string
  room_type_name: string | null
  status: string
}

export async function listRoomsForBlockSelect(
  tenantId: string,
): Promise<RoomForBlockSelect[]> {
  const rows = await db<RoomForBlockSelect[]>`
    SELECT r.id, r.room_number, rt.name AS room_type_name, r.status
    FROM rooms r
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    WHERE r.tenant_id = ${tenantId} AND r.is_active = true
    ORDER BY r.room_number
  `
  return rows
}
