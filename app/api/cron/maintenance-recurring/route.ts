import { NextResponse } from "next/server"
import { generateRecurringMaintenanceInstances } from "@/lib/services/maintenance-core"

/**
 * Called by system cron at 06:00 daily:
 *
 *   0 6 * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
 *     https://pms.bios.co.il/api/cron/maintenance-recurring \
 *     > /var/log/pms-maintenance-recurring.log 2>&1
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret")
  const expected = process.env.CRON_SECRET

  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  if (secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const result = await generateRecurringMaintenanceInstances()

  return NextResponse.json({
    date: new Date().toISOString().slice(0, 10),
    ...result,
  })
}
