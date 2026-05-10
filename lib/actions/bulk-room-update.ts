"use server"

/**
 * Bulk Room Update — server actions
 * ──────────────────────────────────────────────────────────────
 * Thin wrapper around the service layer. All actions derive the
 * tenant/user from the session — never trust client input.
 */

import { requirePermission } from "@/lib/auth/actor"
import { AuthorizationError } from "@/lib/auth/errors"
import type {
  BulkUpdateActionInput,
  BulkUpdateActionResult,
  BulkUpdateFormData,
  BulkUpdatePreview,
} from "@/lib/types/bulk-room-update"
import { bulkUpdateInputSchema } from "@/lib/utils/bulkRoomUpdateValidation"
import {
  computeBulkUpdatePreview,
  executeBulkUpdate,
  fetchBulkUpdateFormData,
} from "@/lib/services/bulkRoomUpdateService"

// ── Form data ────────────────────────────────────────────────

export async function getBulkUpdateFormData(
  atDate?: string,
): Promise<
  | { success: true; data: BulkUpdateFormData }
  | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("rooms", "view")
    const data = await fetchBulkUpdateFormData(actor.tenantId, atDate)
    return { success: true, data }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בטעינת הנתונים",
    }
  }
}

// ── Preview ──────────────────────────────────────────────────

export async function previewBulkRoomUpdate(
  input: BulkUpdateActionInput,
): Promise<
  | { success: true; preview: BulkUpdatePreview }
  | { success: false; error: string }
> {
  try {
    const actor = await requirePermission("rooms", "edit")

    // Parse with zod — never trust client shape
    const parsed = bulkUpdateInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "קלט לא תקין",
      }
    }

    const preview = await computeBulkUpdatePreview(actor.tenantId, parsed.data)
    return { success: true, preview }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בחישוב התצוגה המקדימה",
    }
  }
}

// ── Apply ────────────────────────────────────────────────────

export async function applyBulkRoomUpdate(
  input: BulkUpdateActionInput,
): Promise<BulkUpdateActionResult> {
  try {
    const actor = await requirePermission("rooms", "edit")

    const parsed = bulkUpdateInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "קלט לא תקין",
      }
    }

    const result = await executeBulkUpdate(
      actor.tenantId,
      actor.userId,
      parsed.data,
    )

    return {
      success: result.success,
      error: result.error,
      logId: result.logId,
      affectedRecords: result.affectedRecords,
      skippedRecords: result.skippedRecords,
      warnings: result.warnings,
      preview: result.preview,
    }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "שגיאה בעדכון הקבוצתי",
    }
  }
}
