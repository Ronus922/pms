import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createCleaningTasksForCheckout } from "@/lib/actions/cleaning"

/**
 * Called by system cron at 08:00 daily:
 *
 *   0 8 * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
 *     https://pms.bios.co.il/api/cron/cleaning-morning \
 *     > /var/log/pms-cleaning-cron.log 2>&1
 *
 * Finds every reservation with today's check_out and an active status, then
 * calls createCleaningTasksForCheckout for each. Idempotent by design.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret")
  const expected = process.env.CRON_SECRET

  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    )
  }
  if (secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Every reservation checking out today, across all tenants
  const rows = await db`
    SELECT DISTINCT res.id AS reservation_id, res.tenant_id
    FROM reservations res
    JOIN reservation_rooms rr ON rr.reservation_id = res.id
    WHERE rr.check_out = ${today}::date
      AND res.status IN ('checked_in','confirmed')
  `

  const results: Array<{
    reservation_id: string
    tenant_id: string
    created: number
    skipped: number
  }> = []

  for (const row of rows as unknown as { reservation_id: string; tenant_id: string }[]) {
    const result = await createCleaningTasksForCheckout(
      row.tenant_id,
      row.reservation_id,
      "scheduled_checkout_day"
    )
    results.push({ ...row, ...result })
  }

  const totalCreated = results.reduce((acc, r) => acc + r.created, 0)
  const totalSkipped = results.reduce((acc, r) => acc + r.skipped, 0)

  return NextResponse.json({
    date: today,
    reservations_processed: results.length,
    tasks_created: totalCreated,
    tasks_skipped: totalSkipped,
    details: results,
  })
}
