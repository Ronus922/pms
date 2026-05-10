"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import {
  enqueueJob,
  loadCallContext,
  saveConnection as saveConnectionOrch,
} from "@/lib/integrations/channex/orchestrator"
import {
  deleteWebhook,
  testConnection as testConnectionClient,
} from "@/lib/integrations/channex/client"
import { runChannexWorker } from "@/lib/integrations/channex/worker"
import type {
  ChannexEnvironment,
  ChannelConnectionRow,
  ChannelSyncJobRow,
} from "@/lib/integrations/channex/types"

/* ── Connection ──────────────────────────────────────────────── */

export async function getChannelConnection(): Promise<ChannelConnectionRow | null> {
  const actor = await requirePermission("rooms", "view")
  const [row] = (await db`
    SELECT id, tenant_id, provider, environment, base_url,
           api_key_fingerprint, webhook_id, webhook_secret,
           status, status_detail,
           last_test_at, last_successful_push_at, last_successful_pull_at,
           created_at
    FROM channel_connections
    WHERE tenant_id = ${actor.tenantId}::uuid AND provider = 'channex'
    LIMIT 1
  `) as unknown as Array<{
    id: string
    tenant_id: string
    provider: string
    environment: ChannexEnvironment
    base_url: string
    api_key_fingerprint: string
    webhook_id: string | null
    webhook_secret: string
    status: ChannelConnectionRow["status"]
    status_detail: string | null
    last_test_at: string | null
    last_successful_push_at: string | null
    last_successful_pull_at: string | null
    created_at: string
  }>
  if (!row) return null
  return {
    id: row.id,
    tenantId: row.tenant_id,
    provider: row.provider,
    environment: row.environment,
    baseUrl: row.base_url,
    apiKeyFingerprint: row.api_key_fingerprint,
    webhookId: row.webhook_id,
    webhookSecret: row.webhook_secret,
    status: row.status,
    statusDetail: row.status_detail,
    lastTestAt: row.last_test_at,
    lastSuccessfulPushAt: row.last_successful_push_at,
    lastSuccessfulPullAt: row.last_successful_pull_at,
    createdAt: row.created_at,
  }
}

export async function saveChannelConnection(input: {
  environment: ChannexEnvironment
  apiKey: string
}): Promise<
  | { success: true; connectionId: string }
  | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("rooms", "edit")
    if (!input.apiKey || input.apiKey.length < 10) {
      return { success: false, error: "מפתח API קצר מדי" }
    }
    const res = await saveConnectionOrch({
      tenantId: actor.tenantId,
      userId: actor.userId,
      environment: input.environment,
      apiKey: input.apiKey.trim(),
    })
    if (!res.success) return res
    return { success: true, connectionId: res.id }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

export async function retestConnection(): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const [row] = (await db`
      SELECT id FROM channel_connections
      WHERE tenant_id = ${actor.tenantId}::uuid AND provider = 'channex'
      LIMIT 1
    `) as unknown as Array<{ id: string }>
    if (!row) return { success: false, error: "אין חיבור שמור" }
    const ctx = await loadCallContext(row.id)
    if (!ctx) return { success: false, error: "לא ניתן לטעון חיבור" }
    try {
      await testConnectionClient(ctx)
      await db`
        UPDATE channel_connections
        SET status = 'connected', status_detail = 'ok',
            last_test_at = now(), updated_at = now()
        WHERE id = ${row.id}::uuid
      `
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "test failed"
      await db`
        UPDATE channel_connections
        SET status = 'error', status_detail = ${msg},
            last_test_at = now(), updated_at = now()
        WHERE id = ${row.id}::uuid
      `
      return { success: false, error: msg }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

export async function triggerInitialSync(): Promise<
  { success: true; jobId: string } | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const [conn] = (await db`
      SELECT id FROM channel_connections
      WHERE tenant_id = ${actor.tenantId}::uuid
        AND provider = 'channex'
        AND status = 'connected'
      LIMIT 1
    `) as unknown as Array<{ id: string }>
    if (!conn) return { success: false, error: "אין חיבור פעיל" }

    const jobId = await enqueueJob({
      tenantId: actor.tenantId,
      connectionId: conn.id,
      jobType: "initial_sync",
      payload: {},
      dedupKey: `initial_sync:${conn.id}`,
      priority: 10,
    })
    // Kick worker inline so user sees progress quickly
    await runChannexWorker(5, "inline-initial-sync")
    return { success: true, jobId }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

export async function unlinkChannelConnection(): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const [conn] = (await db`
      SELECT id, webhook_id FROM channel_connections
      WHERE tenant_id = ${actor.tenantId}::uuid AND provider = 'channex'
      LIMIT 1
    `) as unknown as Array<{ id: string; webhook_id: string | null }>
    if (!conn) return { success: false, error: "אין חיבור שמור" }

    // Best-effort deregister webhook
    if (conn.webhook_id) {
      const ctx = await loadCallContext(conn.id)
      if (ctx) {
        try {
          await deleteWebhook(ctx, conn.webhook_id)
        } catch {
          // ignore — we're disabling regardless
        }
      }
    }
    await db`
      UPDATE channel_connections
      SET status = 'disabled', webhook_id = NULL, updated_at = now()
      WHERE id = ${conn.id}::uuid
    `
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

/* ── Worker controls from UI ─────────────────────────────────── */

export async function runChannexWorkerOnce(
  limit = 50,
): Promise<
  | {
      success: true
      picked: number
      done: number
      retried: number
      failed: number
      pendingBefore: number
      pendingAfter: number
    }
  | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const [before] = (await db`
      SELECT COUNT(*)::int AS cnt
      FROM channel_sync_jobs
      WHERE tenant_id = ${actor.tenantId}::uuid
        AND status IN ('pending','retry')
    `) as unknown as Array<{ cnt: number }>
    const res = await runChannexWorker(limit, "inline-ui")
    const [after] = (await db`
      SELECT COUNT(*)::int AS cnt
      FROM channel_sync_jobs
      WHERE tenant_id = ${actor.tenantId}::uuid
        AND status IN ('pending','retry')
    `) as unknown as Array<{ cnt: number }>
    return {
      success: true,
      picked: res.picked,
      done: res.done,
      retried: res.retried,
      failed: res.failed,
      pendingBefore: Number(before?.cnt ?? 0),
      pendingAfter: Number(after?.cnt ?? 0),
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

/**
 * Flush pending Channex jobs immediately:
 *  1. Count newly-queued jobs before we touched their schedule.
 *  2. Bump `scheduled_for` to now() for every pending/retry job so the
 *     trigger's 30-second debounce doesn't delay the auto-sync after a
 *     bulk update.
 *  3. Run the worker to drain the queue in the same request cycle.
 *  4. Report granular status back so the UI can show "local save OK"
 *     vs "channel sync OK/failed" as two distinct user-facing messages.
 *
 * This is the action that Bulk Update calls after a successful DB save.
 * Inline cell edits in the rate grid do NOT call this automatically —
 * they rely on the manual Sync button in the toolbar.
 */
export async function flushPendingChannelJobs(): Promise<
  | {
      success: true
      /** How many jobs existed (pending+retry) before we tried to run them. */
      queuedBefore: number
      /** How many the worker actually picked up in this run. */
      picked: number
      /** How many completed successfully. */
      done: number
      /** How many were rescheduled for a later retry. */
      retried: number
      /** How many gave up and moved to failed status. */
      failed: number
      /** How many jobs are still pending/retry after the run. */
      pendingAfter: number
      /** True if tenant has a connected Channex channel_connections row. */
      channelConnected: boolean
    }
  | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("rooms", "edit")

    // Is there a connected Channex account for this tenant?
    const [conn] = (await db`
      SELECT id FROM channel_connections
      WHERE tenant_id = ${actor.tenantId}::uuid
        AND provider = 'channex'
        AND status = 'connected'
      LIMIT 1
    `) as unknown as Array<{ id: string }>
    const channelConnected = Boolean(conn)

    // Count pending/retry jobs *before* bumping schedule
    const [beforeRow] = (await db`
      SELECT COUNT(*)::int AS cnt
      FROM channel_sync_jobs
      WHERE tenant_id = ${actor.tenantId}::uuid
        AND status IN ('pending','retry')
    `) as unknown as Array<{ cnt: number }>
    const queuedBefore = Number(beforeRow?.cnt ?? 0)

    if (!channelConnected || queuedBefore === 0) {
      // Nothing to flush — return a neutral success so callers can skip UI
      return {
        success: true,
        queuedBefore,
        picked: 0,
        done: 0,
        retried: 0,
        failed: 0,
        pendingAfter: queuedBefore,
        channelConnected,
      }
    }

    // Bypass the 30-second trigger debounce so the auto-sync runs now
    await db`
      UPDATE channel_sync_jobs
      SET scheduled_for = now(), updated_at = now()
      WHERE tenant_id = ${actor.tenantId}::uuid
        AND status IN ('pending','retry')
        AND scheduled_for > now()
    `

    // Drain the queue (up to 500 jobs in one shot for big bulks)
    const res = await runChannexWorker(500, "inline-bulk-flush")

    const [afterRow] = (await db`
      SELECT COUNT(*)::int AS cnt
      FROM channel_sync_jobs
      WHERE tenant_id = ${actor.tenantId}::uuid
        AND status IN ('pending','retry')
    `) as unknown as Array<{ cnt: number }>

    return {
      success: true,
      queuedBefore,
      picked: res.picked,
      done: res.done,
      retried: res.retried,
      failed: res.failed,
      pendingAfter: Number(afterRow?.cnt ?? 0),
      channelConnected: true,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בסנכרון",
    }
  }
}

/* ── Jobs ────────────────────────────────────────────────────── */

export interface JobsListFilter {
  status?: ChannelSyncJobRow["status"] | "all"
  jobType?: ChannelSyncJobRow["job_type"] | "all"
  limit?: number
}

export async function listSyncJobs(
  filter: JobsListFilter = {},
): Promise<ChannelSyncJobRow[]> {
  const actor = await requirePermission("rooms", "view")
  const status = filter.status && filter.status !== "all" ? filter.status : null
  const jobType = filter.jobType && filter.jobType !== "all" ? filter.jobType : null
  const limit = Math.min(filter.limit ?? 100, 500)
  const rows = (await db`
    SELECT *
    FROM channel_sync_jobs
    WHERE tenant_id = ${actor.tenantId}::uuid
      AND (${status}::text IS NULL OR status = ${status}::text)
      AND (${jobType}::text IS NULL OR job_type = ${jobType}::text)
    ORDER BY created_at DESC
    LIMIT ${limit}::int
  `) as unknown as ChannelSyncJobRow[]
  return rows
}

export async function retryJob(
  jobId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    await db`
      UPDATE channel_sync_jobs
      SET status = 'pending',
          attempts = 0,
          scheduled_for = now(),
          last_error = NULL,
          locked_at = NULL,
          locked_by = NULL,
          updated_at = now()
      WHERE id = ${jobId}::uuid
        AND tenant_id = ${actor.tenantId}::uuid
    `
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

export async function cancelJob(
  jobId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    await db`
      UPDATE channel_sync_jobs
      SET status = 'cancelled', updated_at = now()
      WHERE id = ${jobId}::uuid
        AND tenant_id = ${actor.tenantId}::uuid
        AND status IN ('pending','retry','running')
    `
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

export async function retryAllFailedJobs(): Promise<
  { success: true; count: number } | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const rows = (await db`
      UPDATE channel_sync_jobs
      SET status = 'pending',
          attempts = 0,
          scheduled_for = now(),
          last_error = NULL,
          updated_at = now()
      WHERE tenant_id = ${actor.tenantId}::uuid
        AND status = 'failed'
      RETURNING id
    `) as unknown as Array<{ id: string }>
    return { success: true, count: rows.length }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

/* ── Webhook events ──────────────────────────────────────────── */

export async function listWebhookEvents(
  filter: { status?: string | "all"; limit?: number } = {},
): Promise<
  Array<{
    id: string
    event_name: string
    channex_property_id: string | null
    status: string
    received_at: string
    processed_at: string | null
    error: string | null
  }>
> {
  const actor = await requirePermission("rooms", "view")
  const status = filter.status && filter.status !== "all" ? filter.status : null
  const limit = Math.min(filter.limit ?? 100, 500)
  const rows = (await db`
    SELECT id, event_name, channex_property_id, status,
           received_at, processed_at, error
    FROM channel_webhook_events
    WHERE tenant_id = ${actor.tenantId}::uuid
      AND (${status}::text IS NULL OR status = ${status}::text)
    ORDER BY received_at DESC
    LIMIT ${limit}::int
  `) as unknown as Array<{
    id: string
    event_name: string
    channex_property_id: string | null
    status: string
    received_at: string
    processed_at: string | null
    error: string | null
  }>
  return rows
}

export async function getWebhookEvent(
  id: string,
): Promise<{
  id: string
  event_name: string
  payload: unknown
  headers: unknown
  source_ip: string | null
  status: string
  received_at: string
  error: string | null
} | null> {
  const actor = await requirePermission("rooms", "view")
  const [row] = (await db`
    SELECT id, event_name, payload, headers, source_ip::text AS source_ip,
           status, received_at, error
    FROM channel_webhook_events
    WHERE tenant_id = ${actor.tenantId}::uuid
      AND id = ${id}::uuid
    LIMIT 1
  `) as unknown as Array<{
    id: string
    event_name: string
    payload: unknown
    headers: unknown
    source_ip: string | null
    status: string
    received_at: string
    error: string | null
  }>
  return row ?? null
}

export async function replayWebhookEvent(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const [event] = (await db`
      SELECT id, connection_id FROM channel_webhook_events
      WHERE id = ${id}::uuid AND tenant_id = ${actor.tenantId}::uuid
      LIMIT 1
    `) as unknown as Array<{ id: string; connection_id: string | null }>
    if (!event) return { success: false, error: "אירוע לא נמצא" }
    await db`
      UPDATE channel_webhook_events
      SET status = 'received', processed_at = NULL, error = NULL
      WHERE id = ${id}::uuid
    `
    await enqueueJob({
      tenantId: actor.tenantId,
      connectionId: event.connection_id,
      jobType: "webhook_process",
      payload: { event_row_id: event.id },
      priority: 50,
    })
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

/* ── Booking revisions ───────────────────────────────────────── */

export async function listBookingRevisions(
  filter: { processedStatus?: string | "all"; limit?: number } = {},
): Promise<
  Array<{
    id: string
    unique_id: string
    ota_name: string | null
    status: string
    processed_status: string
    ack_status: string
    arrival_date: string | null
    departure_date: string | null
    received_at: string
    error: string | null
    reservation_id: string | null
    payload: Record<string, unknown>
  }>
> {
  const actor = await requirePermission("rooms", "view")
  const ps =
    filter.processedStatus && filter.processedStatus !== "all"
      ? filter.processedStatus
      : null
  const limit = Math.min(filter.limit ?? 100, 500)
  const rows = (await db`
    SELECT id, unique_id, ota_name, status, processed_status, ack_status,
           arrival_date, departure_date, received_at, error,
           reservation_id, payload
    FROM channel_booking_revisions
    WHERE tenant_id = ${actor.tenantId}::uuid
      AND (${ps}::text IS NULL OR processed_status = ${ps}::text)
    ORDER BY received_at DESC
    LIMIT ${limit}::int
  `) as unknown as Array<{
    id: string
    unique_id: string
    ota_name: string | null
    status: string
    processed_status: string
    ack_status: string
    arrival_date: string | null
    departure_date: string | null
    received_at: string
    error: string | null
    reservation_id: string | null
    payload: Record<string, unknown>
  }>
  return rows
}

export async function retryBookingImport(
  revisionId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    const [rev] = (await db`
      SELECT connection_id, channex_property_id
      FROM channel_booking_revisions
      WHERE id = ${revisionId}::uuid
        AND tenant_id = ${actor.tenantId}::uuid
      LIMIT 1
    `) as unknown as Array<{ connection_id: string; channex_property_id: string }>
    if (!rev) return { success: false, error: "רישום לא נמצא" }
    await enqueueJob({
      tenantId: actor.tenantId,
      connectionId: rev.connection_id,
      jobType: "booking_pull",
      payload: { channex_property_id: rev.channex_property_id },
      priority: 20,
    })
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

/* ── Mapping issues ──────────────────────────────────────────── */

export async function listMappingIssues(): Promise<
  Array<{
    id: string
    kind: string
    ota_unique_id: string | null
    snippet: unknown
    status: string
    created_at: string
  }>
> {
  const actor = await requirePermission("rooms", "view")
  const rows = (await db`
    SELECT id, kind, ota_unique_id, snippet, status, created_at
    FROM channel_mapping_issues
    WHERE tenant_id = ${actor.tenantId}::uuid
    ORDER BY created_at DESC
    LIMIT 200
  `) as unknown as Array<{
    id: string
    kind: string
    ota_unique_id: string | null
    snippet: unknown
    status: string
    created_at: string
  }>
  return rows
}

export async function ignoreMappingIssue(
  issueId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    await db`
      UPDATE channel_mapping_issues
      SET status = 'ignored',
          resolved_by = ${actor.userId}::uuid,
          resolved_at = now(),
          updated_at = now()
      WHERE id = ${issueId}::uuid
        AND tenant_id = ${actor.tenantId}::uuid
    `
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

/* ── Delivery errors ─────────────────────────────────────────── */

export async function listDeliveryErrors(): Promise<
  Array<{
    id: string
    job_type: string
    error_code: string | null
    error_message: string | null
    created_at: string
    acknowledged_at: string | null
  }>
> {
  const actor = await requirePermission("rooms", "view")
  const rows = (await db`
    SELECT id, job_type, error_code, error_message, created_at, acknowledged_at
    FROM channel_delivery_errors
    WHERE tenant_id = ${actor.tenantId}::uuid
    ORDER BY created_at DESC
    LIMIT 200
  `) as unknown as Array<{
    id: string
    job_type: string
    error_code: string | null
    error_message: string | null
    created_at: string
    acknowledged_at: string | null
  }>
  return rows
}

export async function ackDeliveryError(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const actor = await requirePermission("rooms", "edit")
    await db`
      UPDATE channel_delivery_errors
      SET acknowledged_by = ${actor.userId}::uuid,
          acknowledged_at = now()
      WHERE id = ${id}::uuid AND tenant_id = ${actor.tenantId}::uuid
    `
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה",
    }
  }
}

/* ── Mapping view data (for /channels/mapping) ────────────── */

export async function listRoomTypeMapping(): Promise<
  Array<{
    room_type_id: string
    room_type_name: string
    room_count: number
    base_price: number
    max_adults: number
    max_children: number
    channex_room_type_id: string | null
    channex_title: string | null
    has_rate_plan: boolean
  }>
> {
  const actor = await requirePermission("rooms", "view")
  const rows = (await db`
    SELECT
      rt.id AS room_type_id,
      rt.name AS room_type_name,
      COALESCE(rt.max_adults, rt.max_occupancy, 2) AS max_adults,
      COALESCE(rt.max_children, 0) AS max_children,
      COALESCE(rt.base_price, 0) AS base_price,
      (SELECT COUNT(*) FROM rooms r
       WHERE r.room_type_id = rt.id
         AND r.tenant_id = ${actor.tenantId}::uuid
         AND r.is_active = true) AS room_count,
      rtl.channex_room_type_id::text AS channex_room_type_id,
      rtl.channex_title,
      EXISTS (
        SELECT 1 FROM channel_rate_plan_links rpl
        WHERE rpl.room_type_link_id = rtl.id AND rpl.is_active = true
      ) AS has_rate_plan
    FROM room_types rt
    LEFT JOIN channel_room_type_links rtl
      ON rtl.room_type_id = rt.id
      AND rtl.tenant_id = ${actor.tenantId}::uuid
    WHERE rt.tenant_id = ${actor.tenantId}::uuid
      AND rt.is_active = true
    ORDER BY rt.sort_order, rt.name
  `) as unknown as Array<{
    room_type_id: string
    room_type_name: string
    max_adults: string | number
    max_children: string | number
    base_price: string | number
    room_count: string | number
    channex_room_type_id: string | null
    channex_title: string | null
    has_rate_plan: boolean
  }>
  return rows.map((r) => ({
    room_type_id: r.room_type_id,
    room_type_name: r.room_type_name,
    max_adults: Number(r.max_adults),
    max_children: Number(r.max_children),
    base_price: Number(r.base_price),
    room_count: Number(r.room_count),
    channex_room_type_id: r.channex_room_type_id,
    channex_title: r.channex_title,
    has_rate_plan: r.has_rate_plan,
  }))
}

/* ── Overview stats ──────────────────────────────────────────── */

export async function getChannexOverviewStats(): Promise<{
  mapped_room_types: number
  total_room_types: number
  pending_jobs: number
  failed_jobs: number
  unacked_revisions: number
  open_mapping_issues: number
  unack_delivery_errors: number
  recent_logs: Array<{
    id: string
    endpoint: string
    http_method: string
    response_status: number | null
    error: string | null
    duration_ms: number | null
    created_at: string
  }>
}> {
  const actor = await requirePermission("rooms", "view")
  const [stats] = (await db`
    SELECT
      (SELECT COUNT(*) FROM channel_room_type_links
       WHERE tenant_id = ${actor.tenantId}::uuid AND is_active = true) AS mapped_room_types,
      (SELECT COUNT(*) FROM room_types
       WHERE tenant_id = ${actor.tenantId}::uuid AND is_active = true) AS total_room_types,
      (SELECT COUNT(*) FROM channel_sync_jobs
       WHERE tenant_id = ${actor.tenantId}::uuid AND status IN ('pending','retry','running')) AS pending_jobs,
      (SELECT COUNT(*) FROM channel_sync_jobs
       WHERE tenant_id = ${actor.tenantId}::uuid AND status = 'failed') AS failed_jobs,
      (SELECT COUNT(*) FROM channel_booking_revisions
       WHERE tenant_id = ${actor.tenantId}::uuid AND ack_status = 'unacked') AS unacked_revisions,
      (SELECT COUNT(*) FROM channel_mapping_issues
       WHERE tenant_id = ${actor.tenantId}::uuid AND status = 'open') AS open_mapping_issues,
      (SELECT COUNT(*) FROM channel_delivery_errors
       WHERE tenant_id = ${actor.tenantId}::uuid AND acknowledged_at IS NULL) AS unack_delivery_errors
  `) as unknown as Array<Record<string, string>>

  const logs = (await db`
    SELECT id, endpoint, http_method, response_status, error, duration_ms, created_at
    FROM channel_sync_logs
    WHERE tenant_id = ${actor.tenantId}::uuid
    ORDER BY created_at DESC
    LIMIT 20
  `) as unknown as Array<{
    id: string
    endpoint: string
    http_method: string
    response_status: number | null
    error: string | null
    duration_ms: number | null
    created_at: string
  }>

  return {
    mapped_room_types: Number(stats.mapped_room_types ?? 0),
    total_room_types: Number(stats.total_room_types ?? 0),
    pending_jobs: Number(stats.pending_jobs ?? 0),
    failed_jobs: Number(stats.failed_jobs ?? 0),
    unacked_revisions: Number(stats.unacked_revisions ?? 0),
    open_mapping_issues: Number(stats.open_mapping_issues ?? 0),
    unack_delivery_errors: Number(stats.unack_delivery_errors ?? 0),
    recent_logs: logs,
  }
}
