/**
 * Channex.io v1 API client.
 *
 * Every public function takes a `ChannexCallContext` (connection + decrypted
 * api key) as its first argument. Every call is logged into
 * `channel_sync_logs` — success or failure. Errors are typed
 * (`ChannexError` subclasses) so the orchestrator can branch on retry policy.
 *
 * Docs: https://docs.channex.io
 * Base URLs:
 *   staging:    https://staging.channex.io/api/v1
 *   production: https://channex.io/api/v1
 * Auth header: `user-api-key: <token>`
 */

import "server-only"
import { db } from "@/lib/db"
import {
  ChannexAuthError,
  ChannexError,
  ChannexNetworkError,
  ChannexRateLimitError,
  ChannexTimeoutError,
  ChannexValidationError,
} from "./errors"
import type {
  ChannexAvailabilityValue,
  ChannexBookingRevision,
  ChannexBookingRevisionFeedResponse,
  ChannexCallContext,
  ChannexProperty,
  ChannexPropertyInput,
  ChannexPushResult,
  ChannexPushWarning,
  ChannexRatePlan,
  ChannexRatePlanInput,
  ChannexRestrictionValue,
  ChannexRoomType,
  ChannexRoomTypeInput,
  ChannexWebhookRecord,
  ChannexWebhookSubscribeInput,
} from "./types"

const DEFAULT_TIMEOUT_MS = 30_000

interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE"
  path: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  jobId?: string | null
  /** If true, the call is skipped when validation warnings appear (we still log + return them). */
  tolerateWarnings?: boolean
}

/* ── Internal request engine ─────────────────────────────────── */

async function request<T>(
  ctx: ChannexCallContext,
  opts: RequestOptions,
): Promise<{ data: T; warnings: ChannexPushWarning[]; status: number }> {
  const url = buildUrl(ctx.baseUrl, opts.path, opts.query)
  const startedAt = Date.now()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  let responseStatus: number | null = null
  let responseBody: unknown = null
  let errorMessage: string | null = null
  let warnings: ChannexPushWarning[] = []

  try {
    const init: RequestInit = {
      method: opts.method,
      signal: controller.signal,
      headers: {
        "user-api-key": ctx.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
    }
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body)

    const res = await fetch(url, init)
    responseStatus = res.status

    const text = await res.text()
    responseBody = text ? safeParseJson(text) : null

    // ── Handle well-known failure paths ────────────────────────
    if (res.status === 401) {
      throw new ChannexAuthError(
        extractErrorMessage(responseBody) ?? "unauthorized",
        responseBody,
      )
    }
    if (res.status === 429) {
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"))
      throw new ChannexRateLimitError(retryAfter, responseBody)
    }
    if (res.status >= 500) {
      throw new ChannexError({
        code: "server",
        message: `Channex server error ${res.status}`,
        httpStatus: res.status,
        response: responseBody,
      })
    }
    if (res.status === 404) {
      throw new ChannexError({
        code: "not_found",
        message: extractErrorMessage(responseBody) ?? "not found",
        httpStatus: 404,
        response: responseBody,
      })
    }
    if (res.status >= 400) {
      throw new ChannexError({
        code: "validation",
        message: extractErrorMessage(responseBody) ?? "bad request",
        httpStatus: res.status,
        response: responseBody,
      })
    }

    // Validation warnings in 200 responses — per ARI docs
    warnings = extractWarnings(responseBody)
    if (warnings.length > 0 && !opts.tolerateWarnings) {
      // Log still succeeds (200) — but caller should know
      // We DO NOT throw here; the typed result surfaces warnings.
    }

    return {
      data: extractData<T>(responseBody),
      warnings,
      status: res.status,
    }
  } catch (err) {
    if (err instanceof ChannexError) {
      errorMessage = err.message
      throw err
    }
    // Timeout / network / abort
    if (err instanceof Error && err.name === "AbortError") {
      errorMessage = "timeout"
      throw new ChannexTimeoutError()
    }
    errorMessage = err instanceof Error ? err.message : "unknown"
    throw new ChannexNetworkError(err)
  } finally {
    clearTimeout(timeout)
    // Fire-and-forget log write (never blocks the caller for >1 round trip)
    const duration = Date.now() - startedAt
    try {
      await db`
        INSERT INTO channel_sync_logs
          (tenant_id, connection_id, job_id, direction, endpoint, http_method,
           request_body, response_status, response_body, response_warnings,
           duration_ms, error)
        VALUES
          (${ctx.tenantId}::uuid,
           ${ctx.connectionId}::uuid,
           ${opts.jobId ?? null}::uuid,
           'outbound',
           ${opts.path},
           ${opts.method},
           ${opts.body ? JSON.stringify(opts.body) : null}::jsonb,
           ${responseStatus},
           ${responseBody ? JSON.stringify(responseBody) : null}::jsonb,
           ${warnings.length > 0 ? JSON.stringify(warnings) : null}::jsonb,
           ${duration},
           ${errorMessage})
      `
    } catch {
      // Never let logging crash the call
    }
  }
}

/* ── Public API methods ──────────────────────────────────────── */

export async function testConnection(ctx: ChannexCallContext): Promise<boolean> {
  // GET /properties returns 200 + data array (possibly empty) for valid keys.
  await request<unknown>(ctx, { method: "GET", path: "/properties" })
  return true
}

export async function listProperties(
  ctx: ChannexCallContext,
): Promise<ChannexProperty[]> {
  const res = await request<ChannexProperty[] | { data?: unknown }>(ctx, {
    method: "GET",
    path: "/properties",
  })
  return asArray<ChannexProperty>(res.data)
}

export async function createProperty(
  ctx: ChannexCallContext,
  input: ChannexPropertyInput,
  jobId?: string,
): Promise<ChannexProperty> {
  const res = await request<{ id: string } & ChannexPropertyInput>(ctx, {
    method: "POST",
    path: "/properties",
    body: { property: input },
    jobId,
  })
  return {
    id: (res.data as { id: string }).id,
    title: input.title,
    currency: input.currency,
    timezone: input.timezone,
    property_type: input.property_type,
  }
}

export async function createRoomType(
  ctx: ChannexCallContext,
  propertyId: string,
  input: ChannexRoomTypeInput,
  jobId?: string,
): Promise<ChannexRoomType> {
  const res = await request<{ id: string } & ChannexRoomTypeInput>(ctx, {
    method: "POST",
    path: `/properties/${propertyId}/room_types`,
    body: { room_type: input },
    jobId,
  })
  return {
    id: (res.data as { id: string }).id,
    title: input.title,
    count_of_rooms: input.count_of_rooms,
    occ_adults: input.occ_adults,
    occ_children: input.occ_children,
    default_occupancy: input.default_occupancy,
  }
}

export async function createRatePlan(
  ctx: ChannexCallContext,
  propertyId: string,
  input: ChannexRatePlanInput,
  jobId?: string,
): Promise<ChannexRatePlan> {
  const res = await request<{ id: string }>(ctx, {
    method: "POST",
    path: `/properties/${propertyId}/rate_plans`,
    body: { rate_plan: input },
    jobId,
  })
  return {
    id: res.data.id,
    title: input.title,
    room_type_id: input.room_type_id,
    currency: input.currency,
    sell_mode: input.sell_mode,
    rate_mode: input.rate_mode,
    occ_adults: input.occ_adults,
  }
}

/* ── ARI push ────────────────────────────────────────────────── */

export async function pushRestrictions(
  ctx: ChannexCallContext,
  values: ChannexRestrictionValue[],
  jobId?: string,
): Promise<ChannexPushResult> {
  if (values.length === 0) return { ok: true, warnings: [] }
  const res = await request<unknown>(ctx, {
    method: "POST",
    path: "/restrictions",
    body: { values },
    jobId,
    tolerateWarnings: true,
  })
  return { ok: true, warnings: res.warnings }
}

export async function pushAvailability(
  ctx: ChannexCallContext,
  values: ChannexAvailabilityValue[],
  jobId?: string,
): Promise<ChannexPushResult> {
  if (values.length === 0) return { ok: true, warnings: [] }
  const res = await request<{ task_id?: string }>(ctx, {
    method: "POST",
    path: "/availability",
    body: { values },
    jobId,
    tolerateWarnings: true,
  })
  return {
    ok: true,
    warnings: res.warnings,
    meta: { task_id: (res.data as { task_id?: string })?.task_id },
  }
}

/* ── Bookings ────────────────────────────────────────────────── */

export async function listBookingRevisionsFeed(
  ctx: ChannexCallContext,
  propertyId: string,
  jobId?: string,
): Promise<ChannexBookingRevision[]> {
  const res = await request<ChannexBookingRevisionFeedResponse>(ctx, {
    method: "GET",
    path: "/booking_revisions/feed",
    query: { "filter[property_id]": propertyId, "order[inserted_at]": "asc" },
    jobId,
  })
  const body = res.data as unknown as ChannexBookingRevisionFeedResponse
  if (!body?.data) return []
  return body.data.map((row) => row.attributes)
}

export async function acknowledgeBookingRevision(
  ctx: ChannexCallContext,
  revisionId: string,
  jobId?: string,
): Promise<void> {
  await request<unknown>(ctx, {
    method: "POST",
    path: `/booking_revisions/${revisionId}/ack`,
    body: {},
    jobId,
  })
}

/* ── Webhooks ────────────────────────────────────────────────── */

export async function subscribeWebhook(
  ctx: ChannexCallContext,
  input: ChannexWebhookSubscribeInput,
  jobId?: string,
): Promise<ChannexWebhookRecord> {
  const res = await request<{ id: string }>(ctx, {
    method: "POST",
    path: "/webhooks",
    body: { webhook: input },
    jobId,
  })
  return {
    id: res.data.id,
    callback_url: input.callback_url,
    event_mask: input.event_mask,
    property_id: input.property_id ?? null,
    is_active: input.is_active ?? true,
    send_data: input.send_data ?? true,
    is_global: input.is_global ?? false,
  }
}

export async function listWebhooks(
  ctx: ChannexCallContext,
): Promise<ChannexWebhookRecord[]> {
  const res = await request<ChannexWebhookRecord[] | { data?: unknown }>(ctx, {
    method: "GET",
    path: "/webhooks",
  })
  return asArray<ChannexWebhookRecord>(res.data)
}

export async function deleteWebhook(
  ctx: ChannexCallContext,
  webhookId: string,
): Promise<void> {
  await request<unknown>(ctx, {
    method: "DELETE",
    path: `/webhooks/${webhookId}`,
  })
}

/* ── Helpers ─────────────────────────────────────────────────── */

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(
    path.replace(/^\//, ""),
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  )
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const obj = body as Record<string, unknown>
  if (typeof obj.error === "string") return obj.error
  if (obj.errors && Array.isArray(obj.errors) && obj.errors.length > 0) {
    const first = obj.errors[0] as Record<string, unknown>
    if (typeof first.title === "string") return first.title
    if (typeof first.detail === "string") return first.detail
  }
  if (obj.meta && typeof obj.meta === "object") {
    const meta = obj.meta as Record<string, unknown>
    if (typeof meta.message === "string") return meta.message
  }
  return null
}

function extractWarnings(body: unknown): ChannexPushWarning[] {
  if (!body || typeof body !== "object") return []
  const obj = body as Record<string, unknown>
  const meta = obj.meta as Record<string, unknown> | undefined
  const warnings = (meta?.warnings ?? obj.warnings) as unknown
  if (!Array.isArray(warnings)) return []
  return warnings as ChannexPushWarning[]
}

function extractData<T>(body: unknown): T {
  if (!body || typeof body !== "object") return body as T
  const obj = body as Record<string, unknown>
  if ("data" in obj) {
    const inner = obj.data as unknown
    // `data.attributes` shape used by JSON:API-style endpoints
    if (inner && typeof inner === "object" && "attributes" in (inner as object)) {
      return (inner as { attributes: T }).attributes
    }
    return inner as T
  }
  return body as T
}

function asArray<T>(maybe: unknown): T[] {
  if (Array.isArray(maybe)) return maybe as T[]
  if (maybe && typeof maybe === "object" && "data" in maybe) {
    const inner = (maybe as { data: unknown }).data
    if (Array.isArray(inner)) {
      return inner.map((row) =>
        row && typeof row === "object" && "attributes" in row
          ? ((row as { attributes: T }).attributes as T)
          : (row as T),
      )
    }
  }
  return []
}

function parseRetryAfter(header: string | null): number {
  if (!header) return 60
  const n = Number(header)
  if (Number.isFinite(n) && n > 0) return n
  return 60
}
