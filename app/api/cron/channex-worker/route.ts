import { NextResponse } from "next/server"
import { runChannexWorker } from "@/lib/integrations/channex/worker"
import { pruneRateWindows } from "@/lib/integrations/channex/rate-limit"

/**
 * GET /api/cron/channex-worker
 *
 * Invoked by system cron every 60 seconds:
 *   * * * * * curl -H "x-cron-secret: $CRON_SECRET" https://pms.bios.co.il/api/cron/channex-worker
 *
 * Picks pending/retry jobs (up to 50) and runs them. Also prunes ancient
 * rate-window rows once every 10 calls (simple coin-flip).
 */

export async function GET(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-cron-secret")
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const result = await runChannexWorker(50, "cron")

  // Occasional cleanup of rate-window table
  if (Math.random() < 0.1) {
    await pruneRateWindows(24).catch(() => undefined)
  }

  return NextResponse.json({
    ok: true,
    ...result,
  })
}
