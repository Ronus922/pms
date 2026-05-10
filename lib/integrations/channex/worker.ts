/**
 * Channex worker loop.
 *
 * Called by the cron route (every 60s) and by inline "run now" actions
 * (e.g. the sync button in the rate grid). Picks up to `limit` pending
 * jobs, processes them sequentially, and reports a summary.
 *
 * Uses FOR UPDATE SKIP LOCKED so concurrent workers don't double-process.
 */

import "server-only"
import { db } from "@/lib/db"
import { processJob } from "./orchestrator"

export interface WorkerRunResult {
  started_at: string
  finished_at: string
  picked: number
  done: number
  retried: number
  failed: number
  errors: Array<{ job_id: string; error: string }>
}

export async function runChannexWorker(
  limit = 50,
  workerLabel = "cron",
): Promise<WorkerRunResult> {
  const started = new Date()
  const pickedJobs = (await db`
    WITH picked AS (
      SELECT id FROM channel_sync_jobs
      WHERE status IN ('pending','retry')
        AND scheduled_for <= now()
      ORDER BY priority ASC, scheduled_for ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE channel_sync_jobs
    SET status = 'running',
        locked_at = now(),
        locked_by = ${workerLabel}::text,
        updated_at = now()
    WHERE id IN (SELECT id FROM picked)
    RETURNING id
  `) as unknown as Array<{ id: string }>

  let done = 0
  let retried = 0
  let failed = 0
  const errors: Array<{ job_id: string; error: string }> = []

  for (const { id } of pickedJobs) {
    try {
      const result = await processJob(id)
      if (result.status === "done") done++
      else if (result.status === "retry") {
        retried++
        if (result.error) errors.push({ job_id: id, error: result.error })
      } else {
        failed++
        if (result.error) errors.push({ job_id: id, error: result.error })
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : "unknown"
      errors.push({ job_id: id, error: msg })
      // Ensure the job is out of 'running' state
      await db`
        UPDATE channel_sync_jobs
        SET status = 'retry',
            last_error = ${msg},
            scheduled_for = now() + interval '1 minute',
            updated_at = now()
        WHERE id = ${id}::uuid
      `
    }
  }

  return {
    started_at: started.toISOString(),
    finished_at: new Date().toISOString(),
    picked: pickedJobs.length,
    done,
    retried,
    failed,
    errors,
  }
}
