"use server"

/**
 * Absence Requests — server actions
 * ─────────────────────────────────
 * Workflow:
 *   1. Employee files a request via `createAbsenceRequest` (status='pending').
 *      Any active user may file for themselves; employee_id is always
 *      derived from the session — never accepted from the client.
 *   2. Manager (attendance.edit) reviews via `reviewAbsenceRequest`.
 *      Approving materializes the days as attendance_records rows so
 *      they appear on the manager calendar. We skip Saturdays (Asia/
 *      Jerusalem weekend).
 *   3. Employee may cancel their own pending request via
 *      `cancelMyAbsenceRequest`. Once reviewed, only the manager can
 *      undo (currently unimplemented — review is final for Phase 1).
 *
 * entry_type mapping when approving:
 *   vacation     → vacation
 *   sick         → sick
 *   reserve_duty → absence   (no dedicated entry_type; surfaces as היעדרות)
 *   personal     → absence
 *   unpaid       → absence
 *   other        → absence
 *
 * Attachments are metadata-only: caller uploads the binary to
 * Supabase Storage and passes the resulting URL + size + mime here
 * (same pattern as supplier_documents).
 */

import { db } from "@/lib/db"
import { requireActor, requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import { z } from "zod"
import {
  createAbsenceRequestSchema,
  reviewAbsenceRequestSchema,
  listAbsenceRequestsFiltersSchema,
} from "@/lib/schemas/absence-requests"
import type {
  AbsenceRequest,
  AbsenceRequestAttachment,
  AbsenceRequestType,
  AbsenceRequestWithEmployee,
  AttachmentInput,
  CreateAbsenceRequestInput,
  ListAbsenceRequestsFilters,
  ReviewAbsenceRequestInput,
} from "@/lib/types/absence-requests"
import type { AttendanceEntryType } from "@/lib/types/attendance"

/* ── request_type → attendance entry_type ───────────────────── */

const REQUEST_TYPE_TO_ENTRY_TYPE: Record<AbsenceRequestType, AttendanceEntryType> = {
  vacation:     "vacation",
  sick:         "sick",
  reserve_duty: "absence",
  personal:     "absence",
  unpaid:       "absence",
  other:        "absence",
}

/* ── 1. Create request (self) ───────────────────────────────── */

export async function createAbsenceRequest(
  input: CreateAbsenceRequestInput,
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  try {
    const actor = await requireActor()

    const parsed = createAbsenceRequestSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "ולידציה נכשלה" }
    }
    const data = parsed.data

    const [row] = await db`
      INSERT INTO absence_requests
        (tenant_id, employee_id, request_type, start_date, end_date, reason, status)
      VALUES (
        ${actor.tenantId},
        ${actor.userId},
        ${data.request_type},
        ${data.start_date}::date,
        ${data.end_date}::date,
        ${data.reason ?? null},
        'pending'
      )
      RETURNING id
    `
    const requestId = (row as { id: string }).id

    /* Persist attachments (if any) — single batch insert via unnest. */
    if (data.attachments && data.attachments.length > 0) {
      for (const att of data.attachments) {
        await db`
          INSERT INTO absence_request_attachments
            (request_id, tenant_id, url, name, mime, size, uploaded_by)
          VALUES (
            ${requestId},
            ${actor.tenantId},
            ${att.url},
            ${att.name},
            ${att.mime ?? null},
            ${att.size ?? null},
            ${actor.userId}
          )
        `
      }
    }

    return { success: true, requestId }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? "ולידציה נכשלה" }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה ביצירת בקשת היעדרות",
    }
  }
}

/* ── 2. List my requests ────────────────────────────────────── */

export async function listMyAbsenceRequests(): Promise<AbsenceRequest[]> {
  const actor = await requireActor()
  const rows = await db`
    SELECT
      id, tenant_id, employee_id, request_type,
      TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
      TO_CHAR(end_date,   'YYYY-MM-DD') AS end_date,
      total_days, reason, status,
      reviewed_by, reviewed_at, review_note,
      created_at, updated_at
    FROM absence_requests
    WHERE tenant_id = ${actor.tenantId}
      AND employee_id = ${actor.userId}
    ORDER BY created_at DESC
  `
  return rows as unknown as AbsenceRequest[]
}

/* ── 3. List all requests (managers) ────────────────────────── */

export async function listAllAbsenceRequests(
  filters?: ListAbsenceRequestsFilters,
): Promise<
  | { success: true; data: AbsenceRequestWithEmployee[] }
  | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("absence_requests", "edit")

    const parsed = listAbsenceRequestsFiltersSchema.safeParse(filters)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "ולידציה נכשלה" }
    }
    const f = parsed.data ?? {}

    const rows = await db`
      SELECT
        r.id, r.tenant_id, r.employee_id, r.request_type,
        TO_CHAR(r.start_date, 'YYYY-MM-DD') AS start_date,
        TO_CHAR(r.end_date,   'YYYY-MM-DD') AS end_date,
        r.total_days, r.reason, r.status,
        r.reviewed_by, r.reviewed_at, r.review_note,
        r.created_at, r.updated_at,
        e.full_name        AS employee_name,
        rev.full_name      AS reviewer_name,
        COALESCE(a.cnt, 0)::int AS attachments_count
      FROM absence_requests r
      JOIN users e   ON e.id = r.employee_id
      LEFT JOIN users rev ON rev.id = r.reviewed_by
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM absence_request_attachments
        WHERE request_id = r.id
      ) a ON TRUE
      WHERE r.tenant_id = ${actor.tenantId}
        ${f.status      ? db`AND r.status = ${f.status}`           : db``}
        ${f.employee_id ? db`AND r.employee_id = ${f.employee_id}` : db``}
      ORDER BY r.created_at DESC
    `
    return { success: true, data: rows as unknown as AbsenceRequestWithEmployee[] }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בטעינת בקשות היעדרות",
    }
  }
}

/* ── 4. Review request (approve / reject) ───────────────────── */

export async function reviewAbsenceRequest(
  id: string,
  input: ReviewAbsenceRequestInput,
): Promise<{ success: boolean; error?: string; createdRecords?: number }> {
  try {
    const actor = await requirePermission("absence_requests", "edit")

    const parsed = reviewAbsenceRequestSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "ולידציה נכשלה" }
    }
    const data = parsed.data

    const [current] = (await db`
      SELECT
        id, employee_id, request_type, status,
        TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
        TO_CHAR(end_date,   'YYYY-MM-DD') AS end_date
      FROM absence_requests
      WHERE id = ${id} AND tenant_id = ${actor.tenantId}
      LIMIT 1
    `) as unknown as [
      | {
          id: string
          employee_id: string
          request_type: AbsenceRequestType
          status: string
          start_date: string
          end_date: string
        }
      | undefined,
    ]
    if (!current) return { success: false, error: "בקשה לא נמצאה" }
    if (current.status !== "pending") {
      return { success: false, error: `הבקשה כבר ${current.status === "approved" ? "אושרה" : current.status === "rejected" ? "נדחתה" : "בוטלה"}` }
    }

    /* Update status first; if approval-side materialization fails,
     * we'd rather have a reviewed-but-unmaterialized row than the
     * other way round (the manager can re-trigger materialization
     * by inspecting the attendance calendar). */
    await db`
      UPDATE absence_requests SET
        status      = ${data.status},
        reviewed_by = ${actor.userId},
        reviewed_at = NOW(),
        review_note = ${data.review_note ?? null},
        updated_at  = NOW()
      WHERE id = ${id} AND tenant_id = ${actor.tenantId}
    `

    let createdRecords = 0
    if (data.status === "approved") {
      const entryType = REQUEST_TYPE_TO_ENTRY_TYPE[current.request_type]
      const dates = enumerateWorkDates(current.start_date, current.end_date)
      for (const workDate of dates) {
        try {
          await db`
            INSERT INTO attendance_records
              (tenant_id, user_id, clock_in, clock_out, work_date,
               notes, entry_type, source, edited_by, edited_at)
            VALUES (
              ${actor.tenantId},
              ${current.employee_id},
              NULL,
              NULL,
              ${workDate}::date,
              ${`בקשת היעדרות #${current.id.slice(0, 8)}`},
              ${entryType},
              'manager_manual',
              ${actor.userId},
              NOW()
            )
          `
          createdRecords++
        } catch {
          /* Skip the row silently if any DB-level guard fires (e.g. a
           * future per-day uniqueness constraint). Remaining days will
           * still materialize; gaps are visible to the manager on the
           * calendar. */
        }
      }
    }

    return { success: true, createdRecords }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? "ולידציה נכשלה" }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה באישור הבקשה",
    }
  }
}

/* ── 5. Cancel own pending request ──────────────────────────── */

export async function cancelMyAbsenceRequest(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireActor()
    const rows = await db`
      UPDATE absence_requests SET
        status     = 'cancelled',
        updated_at = NOW()
      WHERE id = ${id}
        AND tenant_id = ${actor.tenantId}
        AND employee_id = ${actor.userId}
        AND status = 'pending'
      RETURNING id
    `
    if (rows.length === 0) {
      return { success: false, error: "ניתן לבטל רק בקשות במצב 'ממתין' השייכות לך" }
    }
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בביטול הבקשה",
    }
  }
}

/* ── 6. Add attachment (metadata) ───────────────────────────── */

export async function addAttachment(
  requestId: string,
  file: AttachmentInput,
): Promise<{ success: boolean; error?: string; attachmentId?: string }> {
  try {
    const actor = await requireActor()

    /* The attachment owner is whoever owns the request — verify
     * either self-ownership OR attendance.edit. */
    const [req] = (await db`
      SELECT employee_id, status
      FROM absence_requests
      WHERE id = ${requestId} AND tenant_id = ${actor.tenantId}
      LIMIT 1
    `) as unknown as [{ employee_id: string; status: string } | undefined]
    if (!req) return { success: false, error: "בקשה לא נמצאה" }

    const isOwner = req.employee_id === actor.userId
    if (!isOwner) {
      // Will throw if not allowed.
      await requirePermission("absence_requests", "edit")
    }
    if (req.status !== "pending") {
      return { success: false, error: "ניתן להוסיף קבצים רק לבקשה במצב 'ממתין'" }
    }

    if (!file?.url || !file?.name) {
      return { success: false, error: "חסר URL או שם קובץ" }
    }

    const [row] = await db`
      INSERT INTO absence_request_attachments
        (request_id, tenant_id, url, name, mime, size, uploaded_by)
      VALUES (
        ${requestId},
        ${actor.tenantId},
        ${file.url},
        ${file.name},
        ${file.mime ?? null},
        ${file.size ?? null},
        ${actor.userId}
      )
      RETURNING id
    `
    return { success: true, attachmentId: (row as { id: string }).id }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בהוספת קובץ",
    }
  }
}

/* ── 7. Delete attachment ───────────────────────────────────── */

export async function deleteAttachment(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireActor()

    /* Look up the attachment + its parent request to decide auth. */
    const [att] = (await db`
      SELECT a.id, a.request_id, r.employee_id, r.status
      FROM absence_request_attachments a
      JOIN absence_requests r ON r.id = a.request_id
      WHERE a.id = ${id} AND a.tenant_id = ${actor.tenantId}
      LIMIT 1
    `) as unknown as [
      { id: string; request_id: string; employee_id: string; status: string } | undefined,
    ]
    if (!att) return { success: false, error: "קובץ לא נמצא" }

    const isOwner = att.employee_id === actor.userId
    if (!isOwner) {
      await requirePermission("absence_requests", "edit")
    } else if (att.status !== "pending") {
      return { success: false, error: "ניתן למחוק קבצים רק לבקשה במצב 'ממתין'" }
    }

    await db`
      DELETE FROM absence_request_attachments
      WHERE id = ${id} AND tenant_id = ${actor.tenantId}
    `
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה במחיקת קובץ",
    }
  }
}

/* ── 8. Get attachments for a request ───────────────────────── */

/**
 * Returns the attachment rows for a request. Visible to the request
 * owner OR anyone with `attendance.edit` (the manager review panel).
 */
export async function getAbsenceRequestAttachments(
  requestId: string,
): Promise<
  | { success: true; data: AbsenceRequestAttachment[] }
  | { success: false; error: string }
> {
  try {
    const actor = await requireActor()

    const [req] = (await db`
      SELECT employee_id
      FROM absence_requests
      WHERE id = ${requestId} AND tenant_id = ${actor.tenantId}
      LIMIT 1
    `) as unknown as [{ employee_id: string } | undefined]
    if (!req) return { success: false, error: "בקשה לא נמצאה" }

    if (req.employee_id !== actor.userId) {
      // Will throw if not allowed.
      await requirePermission("absence_requests", "edit")
    }

    const rows = await db`
      SELECT id, request_id, tenant_id, url, name, mime, size,
             uploaded_by, uploaded_at
      FROM absence_request_attachments
      WHERE request_id = ${requestId} AND tenant_id = ${actor.tenantId}
      ORDER BY uploaded_at ASC
    `
    return { success: true, data: rows as unknown as AbsenceRequestAttachment[] }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) return { success: false, error: err.message }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בטעינת קבצים",
    }
  }
}

/* ── Helper: list of dates in inclusive range, skipping Saturday ── */

function enumerateWorkDates(startIso: string, endIso: string): string[] {
  const out: string[] = []
  const start = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)
  for (
    let d = new Date(start.getTime());
    d.getTime() <= end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    /* getUTCDay: 0=Sun, 6=Sat. Skip Saturday only (the project's
     * single weekend day for hospitality staff scheduling). */
    if (d.getUTCDay() === 6) continue
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    out.push(`${y}-${m < 10 ? `0${m}` : m}-${day < 10 ? `0${day}` : day}`)
  }
  return out
}
