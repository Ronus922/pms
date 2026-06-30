// Server-internal cleaning-task layer. NOT a "use server" module: these
// functions are NEVER client-callable Server Actions. They take an EXPLICIT
// tenantId and scope every query to it. Two kinds of caller reach them:
//   • Session path — already-authenticated server actions (reservations.ts,
//     reservation-update.ts, cleaning.ts reads) pass their actor's tenantId.
//   • Service-role path — the cron route calls runMorningCheckoutCleaningForAllTenants(),
//     which iterates tenants and invokes the inner layer once per tenant.
// Keeping them out of a "use server" file is what closes the cross-tenant
// IDOR: a browser cannot invoke them directly with an arbitrary tenantId.

import { db } from "@/lib/db"

/* ── Defaults ───────────────────────────────────────────── */

export const DEFAULT_CHECKOUT_TIME = "11:00:00"

/* ── Helpers ────────────────────────────────────────────── */

export async function getNextOrderIndex(
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

/* ── Service-role cron orchestrator ─────────────────────── */

/**
 * Daily 08:00 cron entry point. SERVICE-ROLE path: there is no acting user,
 * so instead of a wide cross-tenant query we ITERATE the tenants table and
 * invoke the tenant-scoped inner layer once per tenant. Every query below is
 * scoped to a single tenantId injected by the loop — no query ever spans
 * tenants. Reachable only from /api/cron/cleaning-morning (CRON_SECRET).
 */
export async function runMorningCheckoutCleaningForAllTenants(
  date: string
): Promise<{
  tenants_processed: number
  reservations_processed: number
  tasks_created: number
  tasks_skipped: number
  details: Array<{ tenant_id: string; reservation_id: string; created: number; skipped: number }>
}> {
  const tenants = (await db`SELECT id FROM tenants`) as unknown as { id: string }[]

  const details: Array<{
    tenant_id: string
    reservation_id: string
    created: number
    skipped: number
  }> = []

  for (const t of tenants) {
    const tenantId = t.id
    // Per-tenant checkout query — scoped to this tenant only.
    const rows = (await db`
      SELECT DISTINCT res.id AS reservation_id
      FROM reservations res
      JOIN reservation_rooms rr ON rr.reservation_id = res.id
      WHERE res.tenant_id = ${tenantId}
        AND rr.check_out = ${date}::date
        AND res.status IN ('checked_in','confirmed')
    `) as unknown as { reservation_id: string }[]

    for (const row of rows) {
      const result = await createCleaningTasksForCheckout(
        tenantId,
        row.reservation_id,
        "scheduled_checkout_day"
      )
      details.push({ tenant_id: tenantId, reservation_id: row.reservation_id, ...result })
    }
  }

  return {
    tenants_processed: tenants.length,
    reservations_processed: details.length,
    tasks_created: details.reduce((acc, r) => acc + r.created, 0),
    tasks_skipped: details.reduce((acc, r) => acc + r.skipped, 0),
    details,
  }
}
