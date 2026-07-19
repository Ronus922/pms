"use server"

import { db } from "@/lib/db"
import { requireActor, requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import {
  DEFAULT_CHECKOUT_TIME,
  getNextOrderIndex,
  ensureTasksForCheckoutsOn,
  ensureTasksForRecentCheckouts,
  ensureTasksForDirtyRooms,
  ensureTasksForUpcomingCheckouts,
} from "@/lib/services/cleaning-tasks"
import type {
  CleaningTask,
  CleaningStatus,
  CleaningBoard,
  CleanerSummary,
  OccupiedRoomSummary,
} from "@/lib/types/cleaning"

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

/* ── Manager Board Read ─────────────────────────────────── */

export async function getCleaningBoard(
  _tenantId: string,
  date: string
): Promise<CleaningBoard> {
  const actor = await requireActor()
  const tenantId = actor.tenantId

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
  _tenantId: string,
  _userId: string,
  date?: string
): Promise<CleaningTask[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const userId = actor.userId

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
    console.error("[cleaning] action failed:", err)
    return { success: false, error: "שגיאה בשמירה. נסה שוב." }
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
    console.error("[cleaning] action failed:", err)
    return { success: false, error: "שגיאה בשמירה. נסה שוב." }
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
    console.error("[cleaning] action failed:", err)
    return { success: false, error: "שגיאה בשמירה. נסה שוב." }
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
    console.error("[cleaning] action failed:", err)
    return { success: false, error: "שגיאה בשמירה. נסה שוב." }
  }
}

/* ── Cleaner Picker ─────────────────────────────────────── */

/**
 * All active users with role='cleaner' for the current tenant.
 * Used by the "create cleaning task" panel to populate the assignee select.
 */
export async function getCleanersList(
  _tenantId: string
): Promise<CleanerSummary[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
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
    console.error("[cleaning] action failed:", err)
    return { success: false, error: "שגיאה בשמירה. נסה שוב." }
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
    console.error("[cleaning] action failed:", err)
    return { success: false, error: "שגיאה בשמירה. נסה שוב." }
  }
}
