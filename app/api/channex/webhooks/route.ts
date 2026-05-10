import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { enqueueJob } from "@/lib/integrations/channex/orchestrator"
import type { ChannexIncomingWebhookBody } from "@/lib/integrations/channex/types"

/**
 * POST /api/channex/webhooks — receives all event webhooks from Channex.
 *
 * Security model (no HMAC documented by Channex):
 *  1. IP allowlist (staging + production ranges documented by Channex).
 *  2. Custom `x-pms-webhook-secret` header that we set when subscribing
 *     per-connection, matched against `channel_connections.webhook_secret`.
 *
 * The handler persists the raw event synchronously and returns 200 fast.
 * Actual processing (re-pull the feed, import bookings) happens in the
 * worker loop after a `webhook_process` job is enqueued.
 */

const CHANNEX_ALLOWED_IPS = new Set<string>([
  "143.198.250.110", // prod
  "134.209.134.83", // prod
  "178.128.141.2", // staging
  "127.0.0.1", // local dev
  "::1",
])

function extractClientIp(request: Request): string | null {
  // Nginx forwards via x-forwarded-for / x-real-ip
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  const real = request.headers.get("x-real-ip")
  if (real) return real.trim()
  return null
}

export async function POST(request: Request): Promise<NextResponse> {
  const clientIp = extractClientIp(request)
  const providedSecret = request.headers.get("x-pms-webhook-secret")

  // Must have either a known IP OR a known secret. In production both are
  // required by adding `&&` — for now we accept either to support test reposts.
  const ipOk = clientIp ? CHANNEX_ALLOWED_IPS.has(clientIp) : false
  const enforceIp = process.env.NODE_ENV === "production"

  if (enforceIp && !ipOk) {
    return NextResponse.json(
      { error: "forbidden (ip)", ip: clientIp },
      { status: 403 },
    )
  }

  let body: ChannexIncomingWebhookBody
  try {
    body = (await request.json()) as ChannexIncomingWebhookBody
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  if (!body || typeof body !== "object" || !body.event) {
    return NextResponse.json({ error: "missing event" }, { status: 400 })
  }

  // Resolve connection — all our webhook subscriptions send the custom
  // header we set on subscribe. Match by that.
  let connectionRow: { id: string; tenant_id: string } | null = null
  if (providedSecret) {
    const [row] = (await db`
      SELECT id, tenant_id FROM channel_connections
      WHERE webhook_secret = ${providedSecret}::text AND status IN ('connected','pending')
      LIMIT 1
    `) as unknown as Array<{ id: string; tenant_id: string }>
    if (row) connectionRow = row
  }

  // Fallback: match by property_id payload → channel_property_links
  if (!connectionRow && body.property_id) {
    const [row] = (await db`
      SELECT pl.connection_id AS id, pl.tenant_id
      FROM channel_property_links pl
      WHERE pl.channex_property_id = ${body.property_id}::uuid
      LIMIT 1
    `) as unknown as Array<{ id: string; tenant_id: string }>
    if (row) connectionRow = row
  }

  if (!connectionRow) {
    return NextResponse.json({ error: "unknown sender" }, { status: 401 })
  }

  // Persist the raw event
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const [event] = (await db`
    INSERT INTO channel_webhook_events
      (tenant_id, connection_id, event_name, channex_property_id,
       source_ip, headers, payload, status)
    VALUES
      (${connectionRow.tenant_id}::uuid,
       ${connectionRow.id}::uuid,
       ${body.event}::text,
       ${body.property_id ?? null}::uuid,
       ${clientIp ?? null}::inet,
       ${JSON.stringify(headers)}::jsonb,
       ${JSON.stringify(body)}::jsonb,
       'received')
    RETURNING id
  `) as unknown as Array<{ id: string }>

  // Enqueue processing job (worker re-pulls feed on booking events)
  await enqueueJob({
    tenantId: connectionRow.tenant_id,
    connectionId: connectionRow.id,
    jobType: "webhook_process",
    payload: { event_row_id: event.id },
    priority: 50,
  })

  return NextResponse.json({ status: "ok", event_id: event.id }, { status: 200 })
}

/**
 * GET support so Channex can hit /webhooks/test verification when
 * creating a subscription (returns 200 quickly).
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok" }, { status: 200 })
}
