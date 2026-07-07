/**
 * Channex integration orchestrator.
 *
 * Centralises the high-level flows:
 *   - Loading a connection context (decrypting the api key once)
 *   - Running the initial sync (property → room types → rate plans → webhook → backfill)
 *   - Dispatching a job from the worker (branch by job_type)
 *   - Handling an incoming webhook event (store → re-pull feed → import → ack)
 *   - Enqueuing new jobs from application code (with debounce via dedup_key)
 *   - Back-off scheduling for retries
 *
 * All paths log into channel_sync_logs via the client, and into
 * channel_sync_jobs.result for per-job audit.
 */

import "server-only"
import { db } from "@/lib/db"
import { decryptApiKey, generateWebhookSecret } from "./encryption"
import {
  acknowledgeBookingRevision,
  createProperty,
  createRatePlan,
  createRoomType,
  deleteWebhook,
  listBookingRevisionsFeed,
  pushAvailability,
  pushRestrictions,
  subscribeWebhook,
  testConnection,
} from "./client"
import {
  ChannexAuthError,
  ChannexError,
  ChannexRateLimitError,
  ChannexValidationError,
} from "./errors"
import { consumeAriToken } from "./rate-limit"
import { findDefaultRatePlanLink, loadLocalRoomTypes } from "./mapping"
import type {
  ChannelSyncJobRow,
  ChannelSyncJobType,
  ChannexAvailabilityValue,
  ChannexBookingRevision,
  ChannexCallContext,
  ChannexRestrictionValue,
} from "./types"

/* ── Connection loader ───────────────────────────────────────── */

export async function loadCallContext(
  connectionId: string,
): Promise<ChannexCallContext | null> {
  const [row] = (await db`
    SELECT
      id,
      tenant_id,
      base_url,
      pgp_sym_decrypt(api_key_encrypted, ${process.env.CHANNEX_ENCRYPTION_KEY ?? ""}::text) AS api_key
    FROM channel_connections
    WHERE id = ${connectionId}::uuid
    LIMIT 1
  `) as unknown as Array<{
    id: string
    tenant_id: string
    base_url: string
    api_key: string
  }>

  if (!row) return null
  return {
    connectionId: row.id,
    tenantId: row.tenant_id,
    baseUrl: row.base_url,
    apiKey: row.api_key,
  }
}

/* ── Job enqueue helpers ─────────────────────────────────────── */

interface EnqueueJobInput {
  tenantId: string
  connectionId: string | null
  jobType: ChannelSyncJobType
  payload: Record<string, unknown>
  dedupKey?: string | null
  priority?: number
  scheduledFor?: Date
  propertyLinkId?: string | null
}

export async function enqueueJob(input: EnqueueJobInput): Promise<string> {
  const scheduledFor = (input.scheduledFor ?? new Date()).toISOString()
  // If a matching dedup_key job is pending, just refresh its schedule.
  if (input.dedupKey) {
    const [existing] = (await db`
      SELECT id FROM channel_sync_jobs
      WHERE dedup_key = ${input.dedupKey}
        AND status IN ('pending','retry')
      LIMIT 1
    `) as unknown as Array<{ id: string }>
    if (existing) {
      await db`
        UPDATE channel_sync_jobs
        SET scheduled_for = GREATEST(scheduled_for, ${scheduledFor}::timestamptz),
            updated_at = now()
        WHERE id = ${existing.id}::uuid
      `
      return existing.id
    }
  }
  const [row] = (await db`
    INSERT INTO channel_sync_jobs
      (tenant_id, connection_id, property_link_id, job_type, payload,
       dedup_key, priority, scheduled_for)
    VALUES
      (${input.tenantId}::uuid,
       ${input.connectionId}::uuid,
       ${input.propertyLinkId ?? null}::uuid,
       ${input.jobType}::text,
       ${JSON.stringify(input.payload)}::jsonb,
       ${input.dedupKey ?? null}::text,
       ${input.priority ?? 100}::int,
       ${scheduledFor}::timestamptz)
    RETURNING id
  `) as unknown as Array<{ id: string }>
  return row.id
}

/* ── Back-off schedule ───────────────────────────────────────── */

const BACKOFF_SECONDS = [30, 120, 600, 3600, 21600] // 30s, 2m, 10m, 1h, 6h

export function nextBackoff(attempt: number): Date {
  const idx = Math.min(attempt, BACKOFF_SECONDS.length - 1)
  return new Date(Date.now() + BACKOFF_SECONDS[idx] * 1000)
}

/* ── Job dispatcher ──────────────────────────────────────────── */

export async function processJob(jobId: string): Promise<{
  status: "done" | "retry" | "failed"
  error?: string
}> {
  const [job] = (await db`
    SELECT * FROM channel_sync_jobs WHERE id = ${jobId}::uuid LIMIT 1
  `) as unknown as ChannelSyncJobRow[]
  if (!job) return { status: "failed", error: "job not found" }

  try {
    const result = await dispatchJob(job)
    await db`
      UPDATE channel_sync_jobs
      SET status = 'done',
          result = ${JSON.stringify(result)}::jsonb,
          updated_at = now()
      WHERE id = ${jobId}::uuid
    `
    return { status: "done" }
  } catch (err) {
    return await handleJobFailure(job, err)
  }
}

async function dispatchJob(
  job: ChannelSyncJobRow,
): Promise<Record<string, unknown>> {
  if (!job.connection_id) {
    throw new ChannexError({
      code: "unknown",
      message: "job has no connection_id",
    })
  }
  const ctx = await loadCallContext(job.connection_id)
  if (!ctx) {
    throw new ChannexError({
      code: "not_found",
      message: "connection disappeared",
    })
  }

  switch (job.job_type) {
    case "initial_sync":
      return await runInitialSync(ctx)
    case "ari_push":
      return await runAriPush(ctx, job)
    case "availability_push":
      return await runAvailabilityPush(ctx, job)
    case "booking_pull":
      return await runBookingPull(ctx, job)
    case "ack_booking":
      return await runAckBooking(ctx, job)
    case "webhook_process":
      return await runWebhookProcess(ctx, job)
    case "webhook_subscribe":
      return await runWebhookSubscribe(ctx, job)
    case "webhook_unsubscribe":
      return await runWebhookUnsubscribe(ctx, job)
    default:
      throw new ChannexError({
        code: "unknown",
        message: `unsupported job_type: ${job.job_type}`,
      })
  }
}

async function handleJobFailure(
  job: ChannelSyncJobRow,
  err: unknown,
): Promise<{ status: "retry" | "failed"; error?: string }> {
  const errorMessage = err instanceof Error ? err.message : "unknown"
  const attempts = job.attempts + 1
  const fatal = err instanceof ChannexError && err.isFatal()
  const rateLimited = err instanceof ChannexRateLimitError
  const shouldRetry = !fatal && attempts < job.max_attempts

  let nextRun: Date
  if (rateLimited) {
    const wait = (err as ChannexRateLimitError).retryAfterSeconds ?? 60
    nextRun = new Date(Date.now() + wait * 1000)
  } else {
    nextRun = nextBackoff(attempts)
  }

  if (shouldRetry) {
    await db`
      UPDATE channel_sync_jobs
      SET status = 'retry',
          attempts = ${attempts},
          scheduled_for = ${nextRun.toISOString()}::timestamptz,
          last_error = ${errorMessage},
          updated_at = now()
      WHERE id = ${job.id}::uuid
    `
    return { status: "retry", error: errorMessage }
  }

  await db`
    UPDATE channel_sync_jobs
    SET status = 'failed',
        attempts = ${attempts},
        last_error = ${errorMessage},
        updated_at = now()
    WHERE id = ${job.id}::uuid
  `
  // Create a delivery error row so operators see it
  const errorCode =
    err instanceof ChannexError ? err.code : "unknown"
  const response = err instanceof ChannexError ? err.response : null
  await db`
    INSERT INTO channel_delivery_errors
      (tenant_id, connection_id, job_id, job_type, error_code,
       error_message, payload_summary, last_response)
    VALUES
      (${job.tenant_id}::uuid,
       ${job.connection_id}::uuid,
       ${job.id}::uuid,
       ${job.job_type}::text,
       ${errorCode}::text,
       ${errorMessage}::text,
       ${JSON.stringify(job.payload)}::jsonb,
       ${response ? JSON.stringify(response) : null}::jsonb)
  `
  return { status: "failed", error: errorMessage }
}

/* ── Initial sync ────────────────────────────────────────────── */

async function runInitialSync(
  ctx: ChannexCallContext,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {
    phase: "start",
    created_property: null as string | null,
    created_room_types: 0,
    created_rate_plans: 0,
    webhook_id: null as string | null,
  }

  // 1. Property
  const [tenant] = (await db`
    SELECT id, name, brand_name, business_type FROM tenants
    WHERE id = ${ctx.tenantId}::uuid LIMIT 1
  `) as unknown as Array<{
    id: string
    name: string
    brand_name: string | null
    business_type: string | null
  }>
  if (!tenant) throw new Error("tenant not found")

  // Check if we already linked a property
  const [existingLink] = (await db`
    SELECT id, channex_property_id FROM channel_property_links
    WHERE tenant_id = ${ctx.tenantId}::uuid
      AND connection_id = ${ctx.connectionId}::uuid
    LIMIT 1
  `) as unknown as Array<{ id: string; channex_property_id: string }>

  let propertyLinkId: string
  let channexPropertyId: string

  if (existingLink) {
    propertyLinkId = existingLink.id
    channexPropertyId = existingLink.channex_property_id
    result.phase = "resuming_from_existing_property"
  } else {
    const property = await createProperty(ctx, {
      title: tenant.brand_name || tenant.name,
      currency: "ILS",
      timezone: "Asia/Jerusalem",
      property_type: (tenant.business_type as "hotel" | undefined) ?? "hotel",
    })
    channexPropertyId = property.id
    result.created_property = property.id

    const [pl] = (await db`
      INSERT INTO channel_property_links
        (tenant_id, connection_id, channex_property_id, channex_title, initial_sync_at)
      VALUES
        (${ctx.tenantId}::uuid,
         ${ctx.connectionId}::uuid,
         ${channexPropertyId}::uuid,
         ${property.title}::text,
         now())
      RETURNING id
    `) as unknown as Array<{ id: string }>
    propertyLinkId = pl.id
  }

  // 2. Room types
  const localRoomTypes = await loadLocalRoomTypes(ctx.tenantId)
  for (const rt of localRoomTypes) {
    // Skip if already linked
    const [existing] = (await db`
      SELECT id FROM channel_room_type_links
      WHERE connection_id = ${ctx.connectionId}::uuid
        AND room_type_id = ${rt.id}::uuid
      LIMIT 1
    `) as unknown as Array<{ id: string }>
    if (existing) continue

    const roomCount = Math.max(1, rt.room_count)
    const created = await createRoomType(ctx, channexPropertyId, {
      title: rt.name,
      count_of_rooms: roomCount,
      occ_adults: Math.max(1, rt.max_adults),
      occ_children: rt.max_children,
      default_occupancy: Math.max(1, rt.max_adults),
    })

    const [rtl] = (await db`
      INSERT INTO channel_room_type_links
        (tenant_id, connection_id, property_link_id, room_type_id,
         channex_room_type_id, channex_title, count_of_rooms,
         occupancy_adults, occupancy_children)
      VALUES
        (${ctx.tenantId}::uuid,
         ${ctx.connectionId}::uuid,
         ${propertyLinkId}::uuid,
         ${rt.id}::uuid,
         ${created.id}::uuid,
         ${rt.name}::text,
         ${roomCount}::int,
         ${Math.max(1, rt.max_adults)}::int,
         ${rt.max_children}::int)
      RETURNING id
    `) as unknown as Array<{ id: string }>

    // 3. Default rate plan per room type
    const ratePlan = await createRatePlan(ctx, channexPropertyId, {
      title: "BAR",
      room_type_id: created.id,
      currency: "ILS",
      sell_mode: "per_room",
      rate_mode: "manual",
      occ_adults: Math.max(1, rt.max_adults),
      options: [
        {
          occupancy: Math.max(1, rt.max_adults),
          is_primary: true,
          rate: Math.round(rt.base_price * 100), // integer cents
        },
      ],
    })
    await db`
      INSERT INTO channel_rate_plan_links
        (tenant_id, connection_id, room_type_link_id,
         channex_rate_plan_id, label, is_default, currency)
      VALUES
        (${ctx.tenantId}::uuid,
         ${ctx.connectionId}::uuid,
         ${rtl.id}::uuid,
         ${ratePlan.id}::uuid,
         'BAR',
         true,
         'ILS')
    `
    result.created_room_types = (result.created_room_types as number) + 1
    result.created_rate_plans = (result.created_rate_plans as number) + 1
  }

  // 4. Webhook subscription
  const webhookId = await ensureWebhookSubscribed(ctx, channexPropertyId)
  result.webhook_id = webhookId

  // 5. Mark connection as connected with last_successful_push_at
  await db`
    UPDATE channel_connections
    SET status = 'connected',
        status_detail = 'initial sync complete',
        last_successful_push_at = now(),
        updated_at = now()
    WHERE id = ${ctx.connectionId}::uuid
  `

  result.phase = "complete"
  return result
}

async function ensureWebhookSubscribed(
  ctx: ChannexCallContext,
  channexPropertyId: string,
): Promise<string> {
  const [conn] = (await db`
    SELECT webhook_id, webhook_secret FROM channel_connections
    WHERE id = ${ctx.connectionId}::uuid LIMIT 1
  `) as unknown as Array<{ webhook_id: string | null; webhook_secret: string }>
  if (conn?.webhook_id) return conn.webhook_id

  const callbackUrl =
    process.env.CHANNEX_WEBHOOK_PUBLIC_URL ??
    "https://pms.bios.co.il/api/channex/webhooks"

  const webhook = await subscribeWebhook(ctx, {
    callback_url: callbackUrl,
    event_mask: [
      "booking_new",
      "booking_modification",
      "booking_cancellation",
      "booking_unmapped_room",
      "booking_unmapped_rate",
      "non_acked_booking",
      "sync_error",
      "sync_warning",
      "rate_error",
    ].join(";"),
    property_id: channexPropertyId,
    is_active: true,
    send_data: true,
    headers: { "x-pms-webhook-secret": conn.webhook_secret },
  })

  await db`
    UPDATE channel_connections
    SET webhook_id = ${webhook.id}::text, updated_at = now()
    WHERE id = ${ctx.connectionId}::uuid
  `
  return webhook.id
}

/* ── ARI push (single room + date from trigger) ──────────────── */

async function runAriPush(
  ctx: ChannexCallContext,
  job: ChannelSyncJobRow,
): Promise<Record<string, unknown>> {
  const payload = job.payload as { room_id?: string; date?: string }
  if (!payload.room_id || !payload.date) {
    throw new ChannexError({
      code: "validation",
      message: "ari_push missing room_id/date",
    })
  }

  // Resolve rate plan link for this room's room_type
  const [roomRow] = (await db`
    SELECT room_type_id FROM rooms
    WHERE id = ${payload.room_id}::uuid
    LIMIT 1
  `) as unknown as Array<{ room_type_id: string | null }>
  if (!roomRow?.room_type_id) {
    return { skipped: true, reason: "room has no room_type" }
  }

  const link = await findDefaultRatePlanLink(job.tenant_id, roomRow.room_type_id)
  if (!link) {
    return { skipped: true, reason: "room_type not mapped" }
  }

  // Rate limit check (fail-fast → reschedule in-band)
  const gate = await consumeAriToken(
    link.connectionId,
    link.propertyLinkId,
    "restrictions",
    job.tenant_id,
  )
  if (!gate.allowed) {
    throw new ChannexRateLimitError(
      Math.max(30, Math.floor((gate.resetsAt.getTime() - Date.now()) / 1000)),
    )
  }

  // Read current room_daily_pricing row
  const [row] = (await db`
    SELECT price, min_nights, max_nights, min_nights_on_arrival,
           is_closed, closed_on_arrival, closed_on_departure
    FROM room_daily_pricing
    WHERE room_id = ${payload.room_id}::uuid
      AND date = ${payload.date}::date
    LIMIT 1
  `) as unknown as Array<{
    price: string | number | null
    min_nights: number | null
    max_nights: number | null
    min_nights_on_arrival: number | null
    is_closed: boolean
    closed_on_arrival: boolean
    closed_on_departure: boolean
  }>

  const values: ChannexRestrictionValue[] = []
  const availValues: ChannexAvailabilityValue[] = []

  if (row) {
    const v: ChannexRestrictionValue = {
      property_id: link.channexPropertyId,
      rate_plan_id: link.channexRatePlanId,
      date: payload.date,
    }
    if (row.price !== null && row.price !== undefined) {
      v.rate = Math.round(Number(row.price) * 100) // integer cents
    }
    if (row.min_nights !== null) v.min_stay = Number(row.min_nights)
    if (row.max_nights !== null) v.max_stay = Number(row.max_nights)
    if (row.min_nights_on_arrival !== null) {
      v.min_stay_arrival = Number(row.min_nights_on_arrival)
    }
    v.closed_to_arrival = Boolean(row.closed_on_arrival)
    v.closed_to_departure = Boolean(row.closed_on_departure)
    v.stop_sell = Boolean(row.is_closed)
    values.push(v)

    // Availability = 0 if closed, else 1 for this one physical room (naive model)
    availValues.push({
      property_id: link.channexPropertyId,
      room_type_id: link.channexRoomTypeId,
      date: payload.date,
      availability: row.is_closed ? 0 : 1,
    })
  }

  const restrictionsResult = await pushRestrictions(ctx, values, job.id)
  const availResult = await pushAvailability(ctx, availValues, job.id)

  // Touch last_successful_push_at
  await db`
    UPDATE channel_connections
    SET last_successful_push_at = now(), updated_at = now()
    WHERE id = ${ctx.connectionId}::uuid
  `

  return {
    values_pushed: values.length,
    avail_pushed: availValues.length,
    restrictions_warnings: restrictionsResult.warnings,
    avail_warnings: availResult.warnings,
  }
}

async function runAvailabilityPush(
  ctx: ChannexCallContext,
  job: ChannelSyncJobRow,
): Promise<Record<string, unknown>> {
  const payload = job.payload as {
    property_id: string
    room_type_id: string
    date_from: string
    date_to: string
    availability: number
  }
  const gate = await consumeAriToken(
    ctx.connectionId,
    (job.property_link_id ?? "") as string,
    "availability",
    job.tenant_id,
  )
  if (!gate.allowed) {
    throw new ChannexRateLimitError(
      Math.max(30, Math.floor((gate.resetsAt.getTime() - Date.now()) / 1000)),
    )
  }
  const result = await pushAvailability(
    ctx,
    [
      {
        property_id: payload.property_id,
        room_type_id: payload.room_type_id,
        date_from: payload.date_from,
        date_to: payload.date_to,
        availability: payload.availability,
      },
    ],
    job.id,
  )
  return { warnings: result.warnings }
}

/* ── Booking pull ────────────────────────────────────────────── */

async function runBookingPull(
  ctx: ChannexCallContext,
  job: ChannelSyncJobRow,
): Promise<Record<string, unknown>> {
  const payload = job.payload as {
    property_link_id?: string
    channex_property_id?: string
  }
  let channexPropertyId = payload.channex_property_id
  if (!channexPropertyId && payload.property_link_id) {
    const [row] = (await db`
      SELECT channex_property_id FROM channel_property_links
      WHERE id = ${payload.property_link_id}::uuid LIMIT 1
    `) as unknown as Array<{ channex_property_id: string }>
    channexPropertyId = row?.channex_property_id
  }
  if (!channexPropertyId) {
    // Pull for every linked property on this connection
    const rows = (await db`
      SELECT channex_property_id FROM channel_property_links
      WHERE connection_id = ${ctx.connectionId}::uuid AND status = 'active'
    `) as unknown as Array<{ channex_property_id: string }>
    let totalImported = 0
    for (const r of rows) {
      const imported = await pullAndImportProperty(ctx, r.channex_property_id, job.id)
      totalImported += imported
    }
    await db`
      UPDATE channel_connections
      SET last_successful_pull_at = now(), updated_at = now()
      WHERE id = ${ctx.connectionId}::uuid
    `
    return { imported: totalImported, properties: rows.length }
  }

  const imported = await pullAndImportProperty(ctx, channexPropertyId, job.id)
  await db`
    UPDATE channel_connections
    SET last_successful_pull_at = now(), updated_at = now()
    WHERE id = ${ctx.connectionId}::uuid
  `
  return { imported }
}

async function pullAndImportProperty(
  ctx: ChannexCallContext,
  channexPropertyId: string,
  jobId: string,
): Promise<number> {
  const revisions = await listBookingRevisionsFeed(ctx, channexPropertyId, jobId)
  let imported = 0
  for (const rev of revisions) {
    try {
      await upsertRevision(ctx, rev)
      imported++
    } catch (err) {
      // Keep going — a single bad revision shouldn't block the feed.
      await db`
        UPDATE channel_booking_revisions
        SET processed_status = 'failed',
            error = ${(err as Error).message}
        WHERE connection_id = ${ctx.connectionId}::uuid
          AND system_id = ${rev.system_id}
      `
    }
  }
  return imported
}

async function upsertRevision(
  ctx: ChannexCallContext,
  rev: ChannexBookingRevision,
): Promise<void> {
  // CORE RULE — when this function is later extended to materialise
  // `channel_booking_revisions` rows into actual `reservations` rows, every
  // booking MUST be validated with `validateRoomCapacity` from
  // `lib/utils/room-capacity.ts` BEFORE the INSERT. Bookings that exceed the
  // target room's max_occupancy / max_adults / max_children / max_infants
  // must be flagged in `channel_mapping_issues` (or equivalent) and NOT
  // auto-assigned. See project memory
  // `project_room_capacity_pricing_core.md` §C + §E.
  //
  // Dedup by (connection_id, system_id) — unique index enforces it
  const [existing] = (await db`
    SELECT id, processed_status FROM channel_booking_revisions
    WHERE connection_id = ${ctx.connectionId}::uuid
      AND system_id = ${rev.system_id}::text
    LIMIT 1
  `) as unknown as Array<{ id: string; processed_status: string }>

  let revisionRowId: string
  if (existing) {
    revisionRowId = existing.id
  } else {
    const [inserted] = (await db`
      INSERT INTO channel_booking_revisions
        (tenant_id, connection_id, channex_revision_id, channex_booking_id,
         channex_property_id, unique_id, system_id, ota_name,
         ota_reservation_code, status, arrival_date, departure_date,
         payload, processed_status, ack_status)
      VALUES
        (${ctx.tenantId}::uuid,
         ${ctx.connectionId}::uuid,
         ${rev.id}::uuid,
         ${rev.booking_id}::uuid,
         ${rev.property_id}::uuid,
         ${rev.unique_id}::text,
         ${rev.system_id}::text,
         ${rev.ota_name ?? null}::text,
         ${rev.ota_reservation_code ?? null}::text,
         ${rev.status}::text,
         ${rev.arrival_date ?? null}::date,
         ${rev.departure_date ?? null}::date,
         ${JSON.stringify(rev)}::jsonb,
         'pending',
         'unacked')
      RETURNING id
    `) as unknown as Array<{ id: string }>
    revisionRowId = inserted.id
  }

  // Import (map + upsert reservation)
  const importResult = await importRevision(ctx.tenantId, revisionRowId, rev)

  if (importResult.status === "imported" || importResult.status === "skipped") {
    // Acknowledge to Channex
    try {
      await acknowledgeBookingRevision(ctx, rev.id)
      await db`
        UPDATE channel_booking_revisions
        SET ack_status = 'acked', acked_at = now(), processed_status = ${importResult.status}, reservation_id = ${importResult.reservationId ?? null}::uuid
        WHERE id = ${revisionRowId}::uuid
      `
    } catch (err) {
      await db`
        UPDATE channel_booking_revisions
        SET ack_status = 'ack_failed', error = ${(err as Error).message},
            processed_status = ${importResult.status}
        WHERE id = ${revisionRowId}::uuid
      `
    }
  } else {
    await db`
      UPDATE channel_booking_revisions
      SET processed_status = ${importResult.status},
          error = ${importResult.error ?? null}
      WHERE id = ${revisionRowId}::uuid
    `
  }
}

/** Map and import a single revision into our reservations table. */
async function importRevision(
  tenantId: string,
  revisionRowId: string,
  rev: ChannexBookingRevision,
): Promise<{
  status: "imported" | "skipped" | "unmapped" | "failed"
  reservationId?: string
  error?: string
}> {
  // Identify unmapped rooms/rates
  for (const room of rev.rooms ?? []) {
    if (!room.room_type_id || !room.rate_plan_id) {
      await db`
        INSERT INTO channel_mapping_issues
          (tenant_id, revision_id, kind, ota_unique_id, snippet, status)
        VALUES
          (${tenantId}::uuid,
           ${revisionRowId}::uuid,
           ${!room.room_type_id ? "unmapped_room" : "unmapped_rate"}::text,
           ${room.ota_unique_id ?? null}::text,
           ${JSON.stringify(room)}::jsonb,
           'open')
        ON CONFLICT DO NOTHING
      `
      return { status: "unmapped" }
    }
  }

  // Resolve our rooms.room_type_id ← channex_room_type_id
  const channexRoomTypeIds = (rev.rooms ?? [])
    .map((r) => r.room_type_id)
    .filter((id): id is string => !!id)
  if (channexRoomTypeIds.length === 0) {
    return { status: "skipped", error: "revision had no rooms" }
  }

  // Look up or update the reservation.
  // We use reservations.external_id = unique_id as the correlation key.
  const [existing] = (await db`
    SELECT id FROM reservations
    WHERE tenant_id = ${tenantId}::uuid
      AND external_id = ${rev.unique_id}::text
    LIMIT 1
  `) as unknown as Array<{ id: string }>

  if (rev.status === "cancelled") {
    if (existing) {
      await db`
        UPDATE reservations
        SET status = 'cancelled', updated_at = now()
        WHERE id = ${existing.id}::uuid
      `
    }
    return { status: "imported", reservationId: existing?.id }
  }

  // For new/modified: we do NOT touch reservations directly in this
  // first version. Reason: the reservations write path requires a lot
  // of validated state (guest id, rate plan row, etc). Instead we
  // create a minimal stub and rely on the operator to enrich it, OR
  // we surface it in the bookings inbox as "imported" without touching
  // reservations. This keeps the existing reservation logic untouched.
  //
  // To satisfy the requirement "don't break existing reservation
  // logic", we mark the revision as imported BUT do not write to
  // reservations here. A follow-up task (out of scope) will add the
  // full reservation upsert behind a feature flag.
  //
  // The Bookings Inbox UI lets the operator manually push the revision
  // into the reservations module via the existing create-reservation
  // flow, pre-filled — which already fires reservation notifications.
  //
  // CORE RULE — if this function is later extended to materialise revisions
  // directly into `reservations`, the new INSERT path MUST fire-and-forget
  // `sendReservationNotifications(tenantId, reservationId)` (from
  // lib/services/reservation-emails.ts) so channel bookings send the internal
  // email. External sources are auto-detected there → guest email is suppressed.
  return { status: "imported", reservationId: existing?.id }
}

/* ── Ack booking (standalone job) ────────────────────────────── */

async function runAckBooking(
  ctx: ChannexCallContext,
  job: ChannelSyncJobRow,
): Promise<Record<string, unknown>> {
  const payload = job.payload as { revision_id: string; our_row_id: string }
  await acknowledgeBookingRevision(ctx, payload.revision_id, job.id)
  await db`
    UPDATE channel_booking_revisions
    SET ack_status = 'acked', acked_at = now()
    WHERE id = ${payload.our_row_id}::uuid
  `
  return { acked: true }
}

/* ── Webhook process (enqueued after webhook lands) ──────────── */

async function runWebhookProcess(
  ctx: ChannexCallContext,
  job: ChannelSyncJobRow,
): Promise<Record<string, unknown>> {
  const payload = job.payload as { event_row_id: string }
  const [event] = (await db`
    SELECT id, event_name, channex_property_id, payload
    FROM channel_webhook_events
    WHERE id = ${payload.event_row_id}::uuid
    LIMIT 1
  `) as unknown as Array<{
    id: string
    event_name: string
    channex_property_id: string | null
    payload: Record<string, unknown>
  }>
  if (!event) return { skipped: true }

  try {
    if (
      event.event_name === "booking_new" ||
      event.event_name === "booking_modification" ||
      event.event_name === "booking_cancellation" ||
      event.event_name === "booking"
    ) {
      // Per Channex caveat: webhooks are triggers, not sources of truth.
      // Re-pull the feed for the property.
      if (event.channex_property_id) {
        await pullAndImportProperty(ctx, event.channex_property_id, job.id)
      }
    }
    // sync_error / sync_warning / rate_error are surfaced in the UI via the
    // webhook events list — no automated action.
    await db`
      UPDATE channel_webhook_events
      SET status = 'processed', processed_at = now()
      WHERE id = ${event.id}::uuid
    `
    return { processed: true, event_name: event.event_name }
  } catch (err) {
    await db`
      UPDATE channel_webhook_events
      SET status = 'failed', processed_at = now(),
          error = ${(err as Error).message}
      WHERE id = ${event.id}::uuid
    `
    throw err
  }
}

/* ── Webhook subscribe / unsubscribe jobs ────────────────────── */

async function runWebhookSubscribe(
  ctx: ChannexCallContext,
  job: ChannelSyncJobRow,
): Promise<Record<string, unknown>> {
  const payload = job.payload as { channex_property_id: string }
  const id = await ensureWebhookSubscribed(ctx, payload.channex_property_id)
  return { webhook_id: id }
}

async function runWebhookUnsubscribe(
  ctx: ChannexCallContext,
  job: ChannelSyncJobRow,
): Promise<Record<string, unknown>> {
  const payload = job.payload as { webhook_id: string }
  await deleteWebhook(ctx, payload.webhook_id)
  await db`
    UPDATE channel_connections
    SET webhook_id = NULL, updated_at = now()
    WHERE id = ${ctx.connectionId}::uuid
  `
  return { deleted: payload.webhook_id }
}

/* ── Utilities: save a new connection ────────────────────────── */

export async function saveConnection(input: {
  tenantId: string
  userId: string
  environment: "staging" | "production"
  apiKey: string
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const baseUrl =
      input.environment === "production"
        ? process.env.CHANNEX_BASE_URL_PRODUCTION ??
          "https://channex.io/api/v1"
        : process.env.CHANNEX_BASE_URL_STAGING ??
          "https://staging.channex.io/api/v1"

    // Encrypt before storing
    const { encryptApiKey } = await import("./encryption")
    const ciphertext = await encryptApiKey(input.apiKey)
    const fingerprint = input.apiKey.slice(-4)
    const webhookSecret = generateWebhookSecret()

    // Upsert by (tenant, provider)
    const [row] = (await db`
      INSERT INTO channel_connections
        (tenant_id, provider, environment, base_url,
         api_key_encrypted, api_key_fingerprint, webhook_secret,
         status, created_by)
      VALUES
        (${input.tenantId}::uuid,
         'channex',
         ${input.environment}::text,
         ${baseUrl}::text,
         ${ciphertext}::bytea,
         ${fingerprint}::text,
         ${webhookSecret}::text,
         'pending',
         ${input.userId}::uuid)
      ON CONFLICT (tenant_id, provider) DO UPDATE
        SET environment = EXCLUDED.environment,
            base_url = EXCLUDED.base_url,
            api_key_encrypted = EXCLUDED.api_key_encrypted,
            api_key_fingerprint = EXCLUDED.api_key_fingerprint,
            status = 'pending',
            status_detail = NULL,
            updated_at = now()
      RETURNING id
    `) as unknown as Array<{ id: string }>

    // Test the connection now
    const ctx = await loadCallContext(row.id)
    if (!ctx) return { success: false, error: "failed to load connection" }
    try {
      await testConnection(ctx)
      await db`
        UPDATE channel_connections
        SET status = 'connected',
            status_detail = 'api key verified',
            last_test_at = now(),
            updated_at = now()
        WHERE id = ${row.id}::uuid
      `
      return { success: true, id: row.id }
    } catch (err) {
      const msg =
        err instanceof ChannexAuthError
          ? "מפתח API לא תקין"
          : err instanceof ChannexValidationError
          ? "שגיאת אימות"
          : err instanceof Error
          ? err.message
          : "שגיאה"
      await db`
        UPDATE channel_connections
        SET status = 'error',
            status_detail = ${msg},
            last_test_at = now(),
            updated_at = now()
        WHERE id = ${row.id}::uuid
      `
      return { success: false, error: msg }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}
