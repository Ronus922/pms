"use server"

import { db } from "@/lib/db"
import { requireActor, requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import type {
  CleaningTask,
  CleaningStatus,
  CleaningBoard,
  CleanerSummary,
  OccupiedRoomSummary,
} from "@/lib/types/cleaning"

/* ── Defaults ───────────────────────────────────────────── */

const DEFAULT_CHECKOUT_TIME = "11:00:00"

/* ── Helpers ────────────────────────────────────────────── */

async function getNextOrderIndex(
  tenantId: string,
  assignedTo: string | null
): Promise<number> {
  const [row] = assignedTo
    ? await db`
        SELECT COALESCE(MAX(order_index), 0) + 1 AS next
        FROM housekeeping_tasks
        WHERE tenant_id = ${tenantId} AND assigned_to = ${assignedTo}
      `
    : await db`
        SELECT COALESCE(MAX(order_index), 0) + 1 AS next
        FROM housekeeping_tasks
        WHERE tenant_id = ${tenantId} AND assigned_to IS NULL
      `
  return Number(row.next)
}

/* ── Checkout Side-Effects ──────────────────────────────── */

/**
 * Runs on every real checkout event. Creates a cleaning task per
 * reservation_room linked to the reservation, and flips each room's
 * cleaning_state to 'dirty'. Idempotent by the uq_hk_tasks_auto index.
 */
export async function createCleaningTasksForCheckout(
  tenantId: string,
  reservationId: string,
  source: "manual_checkout" | "scheduled_checkout_day"
): Promise<{ created: number; skipped: number }> {
  // Get reservation + its rooms
  const resRooms = await db`
    SELECT
      rr.id AS reservation_room_id,
      rr.room_id,
      rr.check_in,
      rr.check_out,
      res.estimated_departure_time,
      res.actual_checkout_time
    FROM reservation_rooms rr
    JOIN reservations res ON res.id = rr.reservation_id
    WHERE rr.reservation_id = ${reservationId}
      AND rr.tenant_id = ${tenantId}
  `

  if (resRooms.length === 0) return { created: 0, skipped: 0 }

  let created = 0
  let skipped = 0

  for (const rr of resRooms) {
    // Determine checkout time snapshot
    const checkoutTime =
      (rr.actual_checkout_time
        ? new Date(rr.actual_checkout_time as string)
            .toISOString()
            .slice(11, 19)
        : null) ??
      (rr.estimated_departure_time as string | null) ??
      DEFAULT_CHECKOUT_TIME

    const nextOrder = await getNextOrderIndex(tenantId, null)

    // ON CONFLICT DO NOTHING uses the uq_hk_tasks_auto partial index
    const result = await db`
      INSERT INTO housekeeping_tasks
        (tenant_id, room_id, reservation_id, reservation_room_id,
         checkin_date, checkout_date, checkout_time,
         status, priority, order_index, source_trigger, scheduled_date)
      VALUES
        (${tenantId}, ${rr.room_id}, ${reservationId}, ${rr.reservation_room_id},
         ${rr.check_in}, ${rr.check_out}, ${checkoutTime},
         'pending', 'normal', ${nextOrder}, ${source}, ${rr.check_out})
      ON CONFLICT (reservation_room_id, checkout_date)
        WHERE source_trigger IN ('manual_checkout','scheduled_checkout_day')
      DO NOTHING
      RETURNING id
    `

    if (result.length > 0) {
      created++
      // Flip room to dirty
      await db`
        UPDATE rooms SET cleaning_state = 'dirty', updated_at = NOW()
        WHERE id = ${rr.room_id} AND tenant_id = ${tenantId}
      `
    } else {
      skipped++
    }
  }

  return { created, skipped }
}

/* ── Area Cleaning Task (manual only) ──────────────────────── */

/**
 * Create a manual cleaning task for an operational area (lobby, corridor, etc.).
 * Area tasks have no reservation link, no room_id, and never auto-generate.
 */
export async function createAreaCleaningTask(
  _tenantId: string,
  input: {
    area_id: string
    area_name: string
    assigned_to?: string | null
    scheduled_date: string
    notes?: string
  }
): Promise<{ success: boolean; error?: string; taskId?: string }> {
  try {
    // Manager-only operation.
    const actor = await requirePermission("housekeeping", "edit")
    if (actor.role === "cleaner") {
      throw new AuthorizationError("רק מנהלים יכולים ליצור משימת ניקיון אזור")
    }
    const tenantId = actor.tenantId

    const nextOrder = await getNextOrderIndex(tenantId, input.assigned_to ?? null)

    const result = await db`
      INSERT INTO housekeeping_tasks
        (tenant_id, target_type, target_id, target_label,
         room_id, reservation_id, reservation_room_id,
         assigned_to, status, priority, order_index,
         source_trigger, scheduled_date, checkout_date, notes)
      VALUES
        (${tenantId}, 'area', ${input.area_id}, ${input.area_name},
         NULL, NULL, NULL,
         ${input.assigned_to ?? null}, 'pending', 'normal', ${nextOrder},
         'manager_manual', ${input.scheduled_date}, ${input.scheduled_date},
         ${input.notes ?? null})
      RETURNING id
    `
    const taskId = (result[0] as unknown as { id: string }).id
    return { success: true, taskId }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    const message = err instanceof Error ? err.message : "שגיאה ביצירת משימת ניקיון אזור"
    return { success: false, error: message }
  }
}

/**
 * Cancel pending tasks when a reservation is cancelled. Leaves done tasks.
 */
export async function cancelCleaningTasksForReservation(
  tenantId: string,
  reservationId: string
): Promise<{ cancelled: number }> {
  const result = await db`
    DELETE FROM housekeeping_tasks
    WHERE reservation_id = ${reservationId}
      AND tenant_id = ${tenantId}
      AND status IN ('pending','in_progress')
    RETURNING id
  `
  return { cancelled: result.length }
}

/**
 * Sync checkout_time on pending tasks when reservation time changes.
 */
export async function syncTaskTimesForReservation(
  tenantId: string,
  reservationId: string
): Promise<void> {
  await db`
    UPDATE housekeeping_tasks hk
    SET checkout_time = COALESCE(
      CASE WHEN res.actual_checkout_time IS NOT NULL
           THEN res.actual_checkout_time::time
           ELSE NULL END,
      res.estimated_departure_time,
      ${DEFAULT_CHECKOUT_TIME}::time
    ),
    updated_at = NOW()
    FROM reservations res
    WHERE hk.reservation_id = res.id
      AND hk.reservation_id = ${reservationId}
      AND hk.tenant_id = ${tenantId}
      AND hk.status IN ('pending','in_progress')
  `
}

/* ── Self-healing sweeps ────────────────────────────────── */

/**
 * For every reservation with checkout_date = the given date that has NOT yet
 * had a cleaning task created, create one. Handles the 08:00 cron path and
 * the case where the cron didn't run (e.g. fresh install).
 *
 * Idempotent via the partial unique index.
 */
export async function ensureTasksForCheckoutsOn(
  tenantId: string,
  date: string
): Promise<{ created: number }> {
  // Determine source from the date — today=scheduled, past=manual (retro)
  const rows = await db`
    SELECT DISTINCT res.id AS reservation_id
    FROM reservations res
    JOIN reservation_rooms rr ON rr.reservation_id = res.id
    WHERE res.tenant_id = ${tenantId}
      AND rr.check_out = ${date}::date
      AND res.status NOT IN ('cancelled','no_show')
      AND NOT EXISTS (
        SELECT 1 FROM housekeeping_tasks hk
        WHERE hk.reservation_room_id = rr.id
          AND hk.checkout_date = rr.check_out
          AND hk.source_trigger IN ('manual_checkout','scheduled_checkout_day')
      )
  `

  let created = 0
  for (const row of rows as unknown as { reservation_id: string }[]) {
    const r = await createCleaningTasksForCheckout(
      tenantId,
      row.reservation_id,
      "scheduled_checkout_day"
    )
    created += r.created
  }
  return { created }
}

/**
 * For every reservation with status='checked_out' whose checkout_date is
 * within the given window (default: 14 days back) that has NOT had a task
 * created, create one. Repairs historical data and the "checked out but
 * never cleaned" case the user reported.
 */
export async function ensureTasksForRecentCheckouts(
  tenantId: string,
  daysBack: number = 14
): Promise<{ created: number }> {
  const rows = await db`
    SELECT DISTINCT res.id AS reservation_id
    FROM reservations res
    JOIN reservation_rooms rr ON rr.reservation_id = res.id
    WHERE res.tenant_id = ${tenantId}
      AND res.status = 'checked_out'
      AND rr.check_out >= CURRENT_DATE - (${daysBack}::int || ' days')::interval
      AND rr.check_out <= CURRENT_DATE + INTERVAL '1 day'
      AND NOT EXISTS (
        SELECT 1 FROM housekeeping_tasks hk
        WHERE hk.reservation_room_id = rr.id
          AND hk.checkout_date = rr.check_out
      )
  `

  let created = 0
  for (const row of rows as unknown as { reservation_id: string }[]) {
    const r = await createCleaningTasksForCheckout(
      tenantId,
      row.reservation_id,
      "manual_checkout"
    )
    created += r.created
  }
  return { created }
}

/**
 * For every room with cleaning_state='dirty' or 'in_progress' that has NO
 * active (pending/in_progress) task, create an orphan task. This handles
 * the case where the dirty flag was set without a task row (legacy backfill,
 * or direct DB edit).
 */
export async function ensureTasksForDirtyRooms(
  tenantId: string
): Promise<{ created: number }> {
  // Find dirty rooms without any active task. Use the most recent checked_out
  // reservation_room as the anchor so the task has correct metadata, falling
  // back to an orphan record tied only to the room.
  const rows = await db`
    SELECT
      r.id AS room_id,
      r.cleaning_state,
      last_res.reservation_id,
      last_res.reservation_room_id,
      last_res.check_in,
      last_res.check_out,
      last_res.estimated_departure_time,
      last_res.actual_checkout_time
    FROM rooms r
    LEFT JOIN LATERAL (
      SELECT
        res.id AS reservation_id,
        rr.id AS reservation_room_id,
        rr.check_in,
        rr.check_out,
        res.estimated_departure_time,
        res.actual_checkout_time
      FROM reservation_rooms rr
      JOIN reservations res ON res.id = rr.reservation_id
      WHERE rr.room_id = r.id
        AND rr.check_out <= CURRENT_DATE
        AND res.status NOT IN ('cancelled','no_show')
      ORDER BY rr.check_out DESC
      LIMIT 1
    ) AS last_res ON TRUE
    WHERE r.tenant_id = ${tenantId}
      AND r.is_active = true
      AND r.cleaning_state IN ('dirty','in_progress')
      AND NOT EXISTS (
        SELECT 1 FROM housekeeping_tasks hk
        WHERE hk.room_id = r.id
          AND hk.status IN ('pending','in_progress')
      )
  `

  let created = 0
  for (const row of rows as unknown as Array<{
    room_id: string
    cleaning_state: string
    reservation_id: string | null
    reservation_room_id: string | null
    check_in: string | null
    check_out: string | null
    estimated_departure_time: string | null
    actual_checkout_time: string | null
  }>) {
    const nextOrder = await getNextOrderIndex(tenantId, null)
    const checkoutDate =
      row.check_out ?? new Date().toISOString().slice(0, 10)
    const checkoutTime =
      (row.actual_checkout_time
        ? new Date(row.actual_checkout_time).toISOString().slice(11, 19)
        : null) ??
      row.estimated_departure_time ??
      DEFAULT_CHECKOUT_TIME

    // Use manager_manual so the unique partial index (auto-sources only)
    // does not block us — a dirty room without any reservation record must
    // still get a visible task.
    await db`
      INSERT INTO housekeeping_tasks
        (tenant_id, room_id, reservation_id, reservation_room_id,
         checkin_date, checkout_date, checkout_time,
         status, priority, order_index, source_trigger, scheduled_date)
      VALUES
        (${tenantId}, ${row.room_id}, ${row.reservation_id}, ${row.reservation_room_id},
         ${row.check_in}, ${checkoutDate}, ${checkoutTime},
         ${row.cleaning_state === "in_progress" ? "in_progress" : "pending"},
         'normal', ${nextOrder}, 'manager_manual', ${checkoutDate})
    `
    created++
  }
  return { created }
}

/**
 * Pre-create cleaning tasks for confirmed/checked_in reservations whose
 * check_out falls in the next `daysForward` days. This powers the dispatch
 * board's "plan ahead" workflow — the manager can drag future checkouts
 * onto cleaners without having to click a separate pre-assign button.
 *
 * Uses source_trigger='manager_manual' (the partial unique index only
 * covers auto sources, so this bypasses it; the NOT EXISTS precheck
 * guarantees idempotency).
 */
export async function ensureTasksForUpcomingCheckouts(
  tenantId: string,
  daysForward: number = 3
): Promise<{ created: number }> {
  const rows = await db`
    SELECT
      rr.id AS reservation_room_id,
      rr.room_id,
      rr.check_in,
      rr.check_out,
      res.id AS reservation_id,
      res.estimated_departure_time,
      res.actual_checkout_time
    FROM reservation_rooms rr
    JOIN reservations res ON res.id = rr.reservation_id
    WHERE rr.tenant_id = ${tenantId}
      AND res.status IN ('confirmed','checked_in')
      AND rr.check_out > CURRENT_DATE
      AND rr.check_out <= CURRENT_DATE + (${daysForward}::int || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM housekeeping_tasks hk
        WHERE hk.reservation_room_id = rr.id
          AND hk.checkout_date = rr.check_out
      )
  `

  let created = 0
  for (const row of rows as unknown as Array<{
    reservation_room_id: string
    room_id: string
    reservation_id: string
    check_in: string
    check_out: string
    estimated_departure_time: string | null
    actual_checkout_time: string | null
  }>) {
    const checkoutTime =
      (row.actual_checkout_time
        ? new Date(row.actual_checkout_time).toISOString().slice(11, 19)
        : null) ??
      row.estimated_departure_time ??
      DEFAULT_CHECKOUT_TIME

    const nextOrder = await getNextOrderIndex(tenantId, null)

    await db`
      INSERT INTO housekeeping_tasks
        (tenant_id, room_id, reservation_id, reservation_room_id,
         checkin_date, checkout_date, checkout_time,
         status, priority, order_index, source_trigger, scheduled_date)
      VALUES
        (${tenantId}, ${row.room_id}, ${row.reservation_id}, ${row.reservation_room_id},
         ${row.check_in}, ${row.check_out}, ${checkoutTime},
         'pending', 'normal', ${nextOrder}, 'manager_manual', ${row.check_out})
    `
    created++
  }
  return { created }
}

/* ── Manager Board Read ─────────────────────────────────── */

export async function getCleaningBoard(
  tenantId: string,
  date: string
): Promise<CleaningBoard> {
  // 0. Self-heal — every board load guarantees tasks exist for every room
  //    that should be cleaned. Idempotent via the unique partial index +
  //    NOT EXISTS prechecks. Order matters: retro → today → dirty orphans → future.
  await ensureTasksForRecentCheckouts(tenantId, 14)
  await ensureTasksForCheckoutsOn(tenantId, date)
  await ensureTasksForDirtyRooms(tenantId)
  // 48-hour forward window only — anything further out clutters the
  // "waiting for assignment" board with guests who haven't checked in yet.
  await ensureTasksForUpcomingCheckouts(tenantId, 2)

  // 1. All cleaner users
  const cleanerRows = await db`
    SELECT id, full_name, email, avatar_url
    FROM users
    WHERE tenant_id = ${tenantId}
      AND is_active = true
      AND role = 'cleaner'
    ORDER BY full_name
  `
  const cleaners = cleanerRows as unknown as CleanerSummary[]

  // 2. All tasks visible for this date.
  //    On TODAY's view: show every active task regardless of checkout_date
  //    (past dirty, today's, and planned future), plus done tasks for today.
  //    On any other date: show only tasks whose checkout_date equals the date.
  const taskRows = await db`
    SELECT
      hk.id, hk.tenant_id, hk.room_id, hk.reservation_id, hk.reservation_room_id,
      hk.assigned_to, hk.status, hk.priority,
      hk.checkin_date, hk.checkout_date, hk.checkout_time,
      hk.order_index, hk.source_trigger, hk.notes,
      hk.guest_count, hk.image_url, hk.created_by,
      hk.started_at, hk.completed_at, hk.created_at, hk.updated_at,
      COALESCE(hk.target_type, 'room') AS target_type,
      hk.target_id,
      COALESCE(hk.target_label, r.room_number) AS target_label,
      r.room_number,
      u.full_name AS cleaner_name,
      cu.full_name AS creator_name,
      g.full_name AS guest_name
    FROM housekeeping_tasks hk
    LEFT JOIN rooms r ON r.id = hk.room_id
    LEFT JOIN users u ON u.id = hk.assigned_to
    LEFT JOIN users cu ON cu.id = hk.created_by
    LEFT JOIN reservations res ON res.id = hk.reservation_id
    LEFT JOIN guests g ON g.id = res.guest_id
    WHERE hk.tenant_id = ${tenantId}
      AND (
        (${date}::date = CURRENT_DATE AND hk.status IN ('pending','in_progress'))
        OR hk.checkout_date = ${date}::date
      )
      AND hk.status IN ('pending','in_progress','done')
    ORDER BY hk.assigned_to NULLS FIRST, hk.order_index
  `

  const tasks = taskRows as unknown as CleaningTask[]

  // 3. Group by cleaner
  const byCleaner: Record<string, CleaningTask[]> = {}
  const unassigned: CleaningTask[] = []

  for (const cleaner of cleaners) byCleaner[cleaner.id] = []
  for (const task of tasks) {
    if (task.assigned_to && byCleaner[task.assigned_to]) {
      byCleaner[task.assigned_to].push(task)
    } else {
      unassigned.push(task)
    }
  }

  // 4. Occupied rooms (for pre-assignment drag source).
  //    Uses the same active-stay rule as the derived status: includes
  //    'confirmed' bookings, not just 'checked_in'.
  const occupiedRows = await db`
    SELECT
      r.id AS room_id,
      r.room_number,
      res.id AS reservation_id,
      rr.id AS reservation_room_id,
      g.full_name AS guest_name,
      rr.check_in,
      rr.check_out,
      EXISTS (
        SELECT 1 FROM housekeeping_tasks hk
        WHERE hk.reservation_room_id = rr.id
          AND hk.status IN ('pending','in_progress')
      ) AS has_pending_task
    FROM rooms r
    JOIN reservation_rooms rr ON rr.room_id = r.id
    JOIN reservations res ON res.id = rr.reservation_id
    JOIN guests g ON g.id = res.guest_id
    WHERE r.tenant_id = ${tenantId}
      AND res.status IN ('confirmed','checked_in')
      AND rr.check_in <= CURRENT_DATE
      AND rr.check_out > CURRENT_DATE
    ORDER BY rr.check_out, r.room_number
  `

  const occupiedRooms = occupiedRows as unknown as OccupiedRoomSummary[]

  return { cleaners, byCleaner, unassigned, occupiedRooms }
}

/* ── Cleaner Mobile Read ────────────────────────────────── */

export async function getMyCleaningQueue(
  tenantId: string,
  userId: string,
  date?: string
): Promise<CleaningTask[]> {
  // Cleaner sees:
  //   - All tasks assigned to them with checkout_date = target (the "today" view)
  //   - PLUS any still-pending/in-progress carry-over from previous days
  const targetDate = date ?? new Date().toISOString().slice(0, 10)

  const rows = await db`
    SELECT
      hk.id, hk.tenant_id, hk.room_id, hk.reservation_id, hk.reservation_room_id,
      hk.assigned_to, hk.status, hk.priority,
      hk.checkin_date, hk.checkout_date, hk.checkout_time,
      hk.order_index, hk.source_trigger, hk.notes,
      hk.guest_count, hk.image_url, hk.created_by,
      hk.started_at, hk.completed_at, hk.created_at, hk.updated_at,
      COALESCE(hk.target_type, 'room') AS target_type,
      hk.target_id,
      COALESCE(hk.target_label, r.room_number) AS target_label,
      r.room_number,
      NULL AS cleaner_name,
      cu.full_name AS creator_name,
      g.full_name AS guest_name
    FROM housekeeping_tasks hk
    LEFT JOIN rooms r ON r.id = hk.room_id
    LEFT JOIN users cu ON cu.id = hk.created_by
    LEFT JOIN reservations res ON res.id = hk.reservation_id
    LEFT JOIN guests g ON g.id = res.guest_id
    WHERE hk.tenant_id = ${tenantId}
      AND hk.assigned_to = ${userId}
      AND (
        hk.checkout_date = ${targetDate}::date
        OR (
          hk.checkout_date < CURRENT_DATE
          AND hk.status IN ('pending','in_progress')
        )
      )
      AND hk.status IN ('pending','in_progress','done')
    ORDER BY hk.order_index
  `

  return rows as unknown as CleaningTask[]
}

/* ── Mutations ──────────────────────────────────────────── */

/**
 * Assign (or unassign) a task to a cleaner.
 *
 * After the reassignment, recompute the order_index of the TARGET bucket
 * (the cleaner the task is now on, or the unassigned pool) in natural sort
 * order: checkout_date ASC → checkout_time ASC → room_number ASC. This
 * enforces the "default sort by checkout date/time" rule on every assign.
 *
 * Manual drag-to-reorder (via reorderCleaningTasks) still overrides this.
 */
export async function assignCleaner(
  _tenantId: string,
  taskId: string,
  cleanerUserId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Manager-level operation: only admin/super_admin or users with
    // explicit housekeeping edit permission may assign cleaners.
    // Pure cleaners cannot reassign tasks to themselves or others.
    const actor = await requireActor()
    const isManager = actor.role === "super_admin" || actor.role === "admin"
    if (!isManager) {
      // receptionist/cleaner: must have explicit housekeeping.canEdit
      const hkPerm = actor.permissions.find((p) => p.module === "housekeeping")
      if (!hkPerm?.canEdit || actor.role === "cleaner") {
        throw new AuthorizationError("רק מנהלים יכולים לשייך משימות ניקיון")
      }
    }
    const tenantId = actor.tenantId

    // 1. Flip the assignment
    await db`
      UPDATE housekeeping_tasks
      SET assigned_to = ${cleanerUserId},
          updated_at = NOW()
      WHERE id = ${taskId} AND tenant_id = ${tenantId}
    `

    // 2. Recompute order_index of the target bucket by natural sort
    const sorted = cleanerUserId
      ? await db`
          SELECT hk.id
          FROM housekeeping_tasks hk
          LEFT JOIN rooms r ON r.id = hk.room_id
          WHERE hk.tenant_id = ${tenantId}
            AND hk.assigned_to = ${cleanerUserId}
            AND hk.status IN ('pending','in_progress')
          ORDER BY hk.checkout_date ASC,
                   hk.checkout_time ASC NULLS LAST,
                   r.room_number ASC
        `
      : await db`
          SELECT hk.id
          FROM housekeeping_tasks hk
          LEFT JOIN rooms r ON r.id = hk.room_id
          WHERE hk.tenant_id = ${tenantId}
            AND hk.assigned_to IS NULL
            AND hk.status IN ('pending','in_progress')
          ORDER BY hk.checkout_date ASC,
                   hk.checkout_time ASC NULLS LAST,
                   r.room_number ASC
        `

    for (let i = 0; i < sorted.length; i++) {
      await db`
        UPDATE housekeeping_tasks
        SET order_index = ${i + 1}, updated_at = NOW()
        WHERE id = ${(sorted[i] as { id: string }).id}
          AND tenant_id = ${tenantId}
      `
    }

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}

export async function reorderCleaningTasks(
  _tenantId: string,
  cleanerUserId: string | null,
  orderedTaskIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Reorder is a manager operation. Admin/super_admin only.
    const actor = await requireActor()
    const isManager = actor.role === "super_admin" || actor.role === "admin"
    if (!isManager) {
      const hkPerm = actor.permissions.find((p) => p.module === "housekeeping")
      if (!hkPerm?.canEdit || actor.role === "cleaner") {
        throw new AuthorizationError("רק מנהלים יכולים לסדר משימות ניקיון")
      }
    }
    const tenantId = actor.tenantId

    for (let i = 0; i < orderedTaskIds.length; i++) {
      // Verify each task belongs to the cleaner (or is unassigned)
      if (cleanerUserId) {
        await db`
          UPDATE housekeeping_tasks
          SET order_index = ${i + 1},
              assigned_to = ${cleanerUserId},
              updated_at = NOW()
          WHERE id = ${orderedTaskIds[i]} AND tenant_id = ${tenantId}
        `
      } else {
        await db`
          UPDATE housekeeping_tasks
          SET order_index = ${i + 1},
              assigned_to = NULL,
              updated_at = NOW()
          WHERE id = ${orderedTaskIds[i]} AND tenant_id = ${tenantId}
        `
      }
    }
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}

export async function setCleaningTaskStatus(
  _tenantId: string,
  taskId: string,
  status: CleaningStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    // Cleaner can only update tasks assigned to them.
    // Manager (admin/super_admin) can update any task in their tenant.
    const actor = await requireActor()
    const tenantId = actor.tenantId

    // Look up the task with assignment for ownership check.
    const [task] = await db`
      SELECT room_id, status AS prev_status, assigned_to
      FROM housekeeping_tasks
      WHERE id = ${taskId} AND tenant_id = ${tenantId}
    `
    if (!task) return { success: false, error: "משימה לא נמצאה" }

    const isManager = actor.role === "super_admin" || actor.role === "admin"
    if (!isManager) {
      // Non-managers must own the task or have explicit housekeeping edit.
      const hkPerm = actor.permissions.find((p) => p.module === "housekeeping")
      const isOwner = task.assigned_to === actor.userId
      if (!isOwner && !hkPerm?.canEdit) {
        throw new AuthorizationError("ניתן לעדכן רק משימה שמשויכת אליך")
      }
      // A cleaner role with hkPerm.canEdit but NOT owner — block.
      if (actor.role === "cleaner" && !isOwner) {
        throw new AuthorizationError("ניתן לעדכן רק משימה שמשויכת אליך")
      }
    }

    // Update task
    if (status === "in_progress") {
      await db`
        UPDATE housekeeping_tasks
        SET status = ${status},
            started_at = COALESCE(started_at, NOW()),
            updated_at = NOW()
        WHERE id = ${taskId} AND tenant_id = ${tenantId}
      `
    } else if (status === "done") {
      await db`
        UPDATE housekeeping_tasks
        SET status = ${status},
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${taskId} AND tenant_id = ${tenantId}
      `
    } else {
      await db`
        UPDATE housekeeping_tasks
        SET status = ${status},
            updated_at = NOW()
        WHERE id = ${taskId} AND tenant_id = ${tenantId}
      `
    }

    // Update room cleaning_state — only for room-based tasks.
    // Areas do not have a cleaning_state column.
    // IMPORTANT: cleaning_state is "has this room been cleaned since the last
    // checkout". It is independent of whether a NEW guest is already inside.
    // The derived display state handles the "occupied vs dirty" visual.
    if (task.room_id) {
      if (status === "in_progress") {
        await db`
          UPDATE rooms SET cleaning_state = 'in_progress', updated_at = NOW()
          WHERE id = ${task.room_id} AND tenant_id = ${tenantId}
        `
      } else if (status === "done") {
        await db`
          UPDATE rooms SET cleaning_state = 'clean', updated_at = NOW()
          WHERE id = ${task.room_id} AND tenant_id = ${tenantId}
        `
      } else if (status === "pending") {
        // Revert — room goes back to dirty
        await db`
          UPDATE rooms SET cleaning_state = 'dirty', updated_at = NOW()
          WHERE id = ${task.room_id} AND tenant_id = ${tenantId}
        `
      }
    }

    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}

/* ── Manual Task Creation (Manager Pre-Assignment) ─────── */

/**
 * Manager drags a future-checkout room onto a cleaner. Creates a
 * manager_manual task for that future date.
 */
export async function createManualCleaningTask(
  _tenantId: string,
  input: {
    room_id: string
    reservation_id: string | null
    reservation_room_id: string | null
    checkin_date: string | null
    checkout_date: string
    checkout_time?: string
    cleaner_user_id: string | null
    notes?: string
    scheduled_date?: string
    guest_count?: number | null
    image_url?: string | null
  }
): Promise<{ success: boolean; error?: string; taskId?: string }> {
  try {
    // Manager-only operation.
    const actor = await requirePermission("housekeeping", "edit")
    const isManager = actor.role === "super_admin" || actor.role === "admin"
    if (!isManager && actor.role === "cleaner") {
      throw new AuthorizationError("רק מנהלים יכולים ליצור משימת ניקיון ידנית")
    }
    const tenantId = actor.tenantId

    const nextOrder = await getNextOrderIndex(tenantId, input.cleaner_user_id)
    const time = input.checkout_time ?? DEFAULT_CHECKOUT_TIME
    const scheduledDate = input.scheduled_date ?? input.checkout_date

    // If the caller didn't already provide a reservation link, try to find
    // an active reservation_room for the same room+checkout_date and link
    // the manual task to it. Otherwise the self-healing sweeps in
    // getCleaningBoard (`ensureTasksForCheckoutsOn`, `ensureTasksForUpcomingCheckouts`)
    // would see "this reservation has no task" and create a duplicate
    // unassigned task for the same room.
    let resId = input.reservation_id
    let resRoomId = input.reservation_room_id
    let checkinDate = input.checkin_date
    if (!resRoomId) {
      const [match] = await db`
        SELECT rr.id AS reservation_room_id,
               rr.reservation_id,
               rr.check_in
        FROM reservation_rooms rr
        JOIN reservations res ON res.id = rr.reservation_id
        WHERE rr.tenant_id = ${tenantId}
          AND rr.room_id = ${input.room_id}
          AND rr.check_out = ${input.checkout_date}::date
          AND res.status IN ('confirmed','checked_in','checked_out')
        ORDER BY (res.status = 'checked_in') DESC,
                 (res.status = 'confirmed') DESC,
                 rr.check_out DESC
        LIMIT 1
      `
      if (match) {
        resRoomId = match.reservation_room_id as string
        resId = match.reservation_id as string
        checkinDate = checkinDate ?? (match.check_in as string | null)
      }
    }

    // Adopt-or-insert: if an active task already exists for this room on this
    // checkout_date (typically a self-healed unassigned one for the matching
    // reservation), upgrade IT instead of creating a second row. This is
    // exactly the duplication the user reported — the manual task and the
    // self-healed task end up as siblings for the same room+date otherwise.
    const [existing] = await db`
      SELECT id, assigned_to
      FROM housekeeping_tasks
      WHERE tenant_id = ${tenantId}
        AND room_id = ${input.room_id}
        AND checkout_date = ${input.checkout_date}::date
        AND status IN ('pending','in_progress')
      ORDER BY (assigned_to IS NULL) DESC, created_at ASC
      LIMIT 1
    `
    if (existing) {
      if (existing.assigned_to && existing.assigned_to !== input.cleaner_user_id) {
        return {
          success: false,
          error: "כבר קיימת משימה פעילה לחדר זה בתאריך זה — ערוך אותה ישירות",
        }
      }
      await db`
        UPDATE housekeeping_tasks
        SET assigned_to    = ${input.cleaner_user_id},
            guest_count    = COALESCE(${input.guest_count ?? null}, guest_count),
            image_url      = COALESCE(${input.image_url ?? null},   image_url),
            notes          = COALESCE(${input.notes ?? null},       notes),
            reservation_id      = COALESCE(reservation_id,      ${resId}),
            reservation_room_id = COALESCE(reservation_room_id, ${resRoomId}),
            checkin_date   = COALESCE(checkin_date,   ${checkinDate}),
            source_trigger = 'manager_manual',
            created_by     = COALESCE(created_by, ${actor.userId}),
            order_index    = ${nextOrder},
            updated_at     = NOW()
        WHERE id = ${existing.id as string} AND tenant_id = ${tenantId}
      `
      return { success: true, taskId: existing.id as string }
    }

    const [row] = await db`
      INSERT INTO housekeeping_tasks
        (tenant_id, room_id, reservation_id, reservation_room_id,
         checkin_date, checkout_date, checkout_time,
         assigned_to, status, priority, order_index, source_trigger, notes,
         scheduled_date, guest_count, image_url, created_by)
      VALUES
        (${tenantId}, ${input.room_id}, ${resId}, ${resRoomId},
         ${checkinDate}, ${input.checkout_date}, ${time},
         ${input.cleaner_user_id}, 'pending', 'normal', ${nextOrder},
         'manager_manual', ${input.notes ?? null}, ${scheduledDate},
         ${input.guest_count ?? null}, ${input.image_url ?? null}, ${actor.userId})
      RETURNING id
    `
    return { success: true, taskId: row.id as string }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}

/* ── Cleaner Picker ─────────────────────────────────────── */

/**
 * All active users with role='cleaner' for the current tenant.
 * Used by the "create cleaning task" panel to populate the assignee select.
 */
export async function getCleanersList(
  tenantId: string
): Promise<CleanerSummary[]> {
  const rows = await db`
    SELECT id, full_name, email, avatar_url
    FROM users
    WHERE tenant_id = ${tenantId}
      AND is_active = true
      AND role = 'cleaner'
    ORDER BY full_name
  `
  return rows as unknown as CleanerSummary[]
}

export async function deleteCleaningTask(
  _tenantId: string,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete is manager-only.
    const actor = await requirePermission("housekeeping", "delete")
    if (actor.role === "cleaner") {
      throw new AuthorizationError("רק מנהלים יכולים למחוק משימות ניקיון")
    }
    const tenantId = actor.tenantId

    await db`
      DELETE FROM housekeeping_tasks
      WHERE id = ${taskId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}

export async function updateCleaningTaskNotes(
  _tenantId: string,
  taskId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Cleaner can update notes on their own task. Manager can update any.
    const actor = await requireActor()
    const tenantId = actor.tenantId

    const [task] = await db`
      SELECT assigned_to FROM housekeeping_tasks
      WHERE id = ${taskId} AND tenant_id = ${tenantId}
    `
    if (!task) return { success: false, error: "משימה לא נמצאה" }

    const isManager = actor.role === "super_admin" || actor.role === "admin"
    if (!isManager) {
      const isOwner = task.assigned_to === actor.userId
      if (!isOwner) {
        throw new AuthorizationError("ניתן לערוך הערות רק במשימה שלך")
      }
    }

    await db`
      UPDATE housekeeping_tasks
      SET notes = ${notes}, updated_at = NOW()
      WHERE id = ${taskId} AND tenant_id = ${tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return { success: false, error: err instanceof Error ? err.message : "שגיאה" }
  }
}
