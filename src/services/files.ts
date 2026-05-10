'use server'

// ============================================================
// File upload & management service
// ============================================================

import { createAdminClient, createServerClient } from './supabase'
import { sanitizeFileName } from '../validators/file'
import type { ActionResult } from '../types/common'

// ── Types ──────────────────────────────────────────────────

export type FileRecord = {
  id: string
  bucket: string
  path: string
  original_name: string
  mime_type: string
  size_bytes: number
  entity_type: string
  entity_id: string
  uploaded_by: string
  label: string | null
  created_at: string
}

// ── Service ────────────────────────────────────────────────

/**
 * Upload a file to Supabase Storage and record it in the `files` table.
 *
 * @param params.file - The File object to upload
 * @param params.bucket - Storage bucket name (e.g. "documents", "avatars")
 * @param params.entityType - The entity this file belongs to (e.g. "reservation", "guest")
 * @param params.entityId - The entity's UUID
 * @param params.userId - The uploading user's ID
 */
export async function uploadFile(params: {
  file: File
  bucket: string
  entityType: string
  entityId: string
  userId: string
}): Promise<ActionResult<FileRecord>> {
  const { file, bucket, entityType, entityId, userId } = params
  const admin = createAdminClient()

  // Build a safe file path: entityType/entityId/sanitized-name
  const safeName = sanitizeFileName(file.name)
  const storagePath = `${entityType}/${entityId}/${safeName}`

  // Upload to Supabase Storage
  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return { success: false, error: uploadError.message }
  }

  // Record in the files table
  const { data: record, error: dbError } = await admin
    .from('files')
    .insert({
      bucket,
      path: storagePath,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      entity_type: entityType,
      entity_id: entityId,
      uploaded_by: userId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (dbError || !record) {
    // Cleanup: remove the uploaded file if DB insert failed
    await admin.storage.from(bucket).remove([storagePath])
    return { success: false, error: dbError?.message ?? 'Failed to save file record' }
  }

  return { success: true, data: record as FileRecord }
}

/**
 * Delete a file from storage and remove its DB record.
 */
export async function deleteFile(fileId: string): Promise<ActionResult> {
  const admin = createAdminClient()

  // Fetch the record first to know the storage path
  const { data: record } = await admin
    .from('files')
    .select('bucket, path')
    .eq('id', fileId)
    .single()

  if (!record) {
    return { success: false, error: 'File not found' }
  }

  // Remove from storage
  const { error: storageError } = await admin.storage
    .from(record.bucket)
    .remove([record.path])

  if (storageError) {
    return { success: false, error: storageError.message }
  }

  // Remove from DB
  const { error: dbError } = await admin
    .from('files')
    .delete()
    .eq('id', fileId)

  if (dbError) {
    return { success: false, error: dbError.message }
  }

  return { success: true, data: undefined }
}

/**
 * Get all files linked to a specific entity.
 */
export async function getFilesForEntity(
  entityType: string,
  entityId: string,
): Promise<FileRecord[]> {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('files')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })

  return (data ?? []) as FileRecord[]
}

/**
 * Link an existing file to an additional entity (many-to-many).
 * Creates a row in `file_entity_links` if your schema supports it.
 */
export async function linkFileToEntity(
  fileId: string,
  entityType: string,
  entityId: string,
  label?: string,
): Promise<void> {
  const admin = createAdminClient()

  // TODO: Create a `file_entity_links` table if you need many-to-many file associations
  const { error } = await admin.from('file_entity_links').insert({
    file_id: fileId,
    entity_type: entityType,
    entity_id: entityId,
    label: label ?? null,
    created_at: new Date().toISOString(),
  })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[files] Failed to link file to entity:', error.message)
  }
}
