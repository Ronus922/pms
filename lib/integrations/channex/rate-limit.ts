/**
 * Token-bucket rate limiter for Channex API.
 *
 * Channex documents (per property):
 *   - 10 POST /restrictions per minute
 *   - 10 POST /availability per minute
 *   - 20 total ARI requests per minute
 *
 * We track counts in `channel_rate_windows` keyed by
 * (connection_id, property_link_id, bucket, window_start=minute).
 * A call is allowed if incrementing the counter stays under the cap.
 * If not, the caller should reschedule the job for `window_start + 1 min`.
 */

import "server-only"
import { db } from "@/lib/db"

export type RateBucket = "restrictions" | "availability" | "ari_total"

const CAPS: Record<RateBucket, number> = {
  restrictions: 10,
  availability: 10,
  ari_total: 20,
}

/** Returns true if the call is allowed and counter was incremented. */
export async function consumeRateToken(
  connectionId: string,
  propertyLinkId: string,
  bucket: RateBucket,
  tenantId: string,
): Promise<{ allowed: boolean; resetsAt: Date }> {
  // Truncate to the minute — simple fixed window
  const windowStart = new Date()
  windowStart.setSeconds(0, 0)
  const cap = CAPS[bucket]

  const rows = (await db`
    INSERT INTO channel_rate_windows
      (tenant_id, connection_id, property_link_id, bucket, window_start, count)
    VALUES
      (${tenantId}::uuid,
       ${connectionId}::uuid,
       ${propertyLinkId}::uuid,
       ${bucket}::text,
       ${windowStart.toISOString()}::timestamptz,
       1)
    ON CONFLICT (connection_id, property_link_id, bucket, window_start)
    DO UPDATE SET count = channel_rate_windows.count + 1
    RETURNING count
  `) as unknown as Array<{ count: number }>

  const count = rows[0]?.count ?? 1
  const nextReset = new Date(windowStart.getTime() + 60_000)

  if (count > cap) {
    return { allowed: false, resetsAt: nextReset }
  }
  return { allowed: true, resetsAt: nextReset }
}

/** Also bump ari_total when consuming restrictions or availability. */
export async function consumeAriToken(
  connectionId: string,
  propertyLinkId: string,
  bucket: "restrictions" | "availability",
  tenantId: string,
): Promise<{ allowed: boolean; resetsAt: Date }> {
  const specific = await consumeRateToken(connectionId, propertyLinkId, bucket, tenantId)
  if (!specific.allowed) return specific
  const total = await consumeRateToken(
    connectionId,
    propertyLinkId,
    "ari_total",
    tenantId,
  )
  return total
}

/** Housekeeping — called occasionally to drop ancient windows. */
export async function pruneRateWindows(olderThanHours = 24): Promise<number> {
  const rows = (await db`
    DELETE FROM channel_rate_windows
    WHERE window_start < now() - (${olderThanHours}::int || ' hours')::interval
    RETURNING id
  `) as unknown as Array<{ id: string }>
  return rows.length
}
