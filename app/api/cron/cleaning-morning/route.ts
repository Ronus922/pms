import { NextResponse } from "next/server"
import { runMorningCheckoutCleaningForAllTenants } from "@/lib/services/cleaning-tasks"

/**
 * Called by system cron at 08:00 daily:
 *
 *   0 8 * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
 *     https://pms.bios.co.il/api/cron/cleaning-morning \
 *     > /var/log/pms-cleaning-cron.log 2>&1
 *
 * Service-role entry point. The per-tenant iteration + tenant-scoped task
 * creation lives in runMorningCheckoutCleaningForAllTenants (lib/services),
 * which is NOT a client-callable Server Action. Idempotent by design.
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
  const result = await runMorningCheckoutCleaningForAllTenants(today)

  return NextResponse.json({ date: today, ...result })
}
