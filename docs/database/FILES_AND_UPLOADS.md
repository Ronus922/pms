# Files & Uploads

> Polymorphic file management system with Supabase Storage.
> Two-table architecture: `files` (metadata) and `file_links` (entity associations).
> One file can be linked to multiple entities. Soft delete with scheduled cleanup.

---

## Table Structure

### files

Stores metadata for every uploaded file. The actual binary is in Supabase Storage.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `file_name` | `varchar(255)` | NO | -- | Original file name (as uploaded) |
| `file_path` | `text` | NO | -- | Path within storage bucket |
| `file_url` | `text` | NO | -- | Public or signed URL |
| `file_size` | `bigint` | NO | -- | Size in bytes |
| `mime_type` | `varchar(100)` | NO | -- | MIME type (e.g., `image/jpeg`, `application/pdf`) |
| `file_type` | `file_type` | NO | -- | Logical file category |
| `thumbnail_url` | `text` | YES | `NULL` | Auto-generated thumbnail URL (images only) |
| `width` | `integer` | YES | `NULL` | Image width in pixels |
| `height` | `integer` | YES | `NULL` | Image height in pixels |
| `storage_bucket` | `varchar(100)` | NO | -- | Supabase Storage bucket name |
| `checksum` | `varchar(64)` | YES | `NULL` | SHA-256 hash for deduplication |
| `alt_text` | `varchar(500)` | YES | `NULL` | Accessibility alt text |
| `metadata` | `jsonb` | NO | `'{}'` | Extension fields (EXIF, duration, page count, etc.) |
| `created_by` | `uuid` | YES | `NULL` | FK to users -- uploader |
| `created_at` | `timestamptz` | NO | `now()` | Upload timestamp |
| `deleted_at` | `timestamptz` | YES | `NULL` | Soft delete timestamp |

**Indexes:**
- `idx_files_checksum` on `checksum` WHERE `deleted_at IS NULL`
- `idx_files_file_type` on `file_type`
- `idx_files_created_by` on `created_by`
- `idx_files_deleted_at` on `deleted_at` WHERE `deleted_at IS NOT NULL`

**Relationships:**
- `created_by` -> `users(id)` ON DELETE SET NULL
- Referenced by: `file_links.file_id`

**RLS Policies:**
- SELECT: Authenticated users can read non-deleted files
- INSERT: Authenticated users
- UPDATE: File owner or admin
- DELETE: Soft delete only -- update `deleted_at`

---

### file_links

Polymorphic join table. Links files to any entity in the system.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `file_id` | `uuid` | NO | -- | FK to files |
| `entity_type` | `varchar(50)` | NO | -- | Target table name (e.g., `task`, `user`, `room`) |
| `entity_id` | `uuid` | NO | -- | Target record ID |
| `sort_order` | `integer` | NO | `0` | Display order within the entity |
| `label` | `varchar(100)` | YES | `NULL` | Context label (e.g., "תמונה ראשית", "חשבונית", "לפני תיקון") |
| `created_by` | `uuid` | YES | `NULL` | FK to users |
| `created_at` | `timestamptz` | NO | `now()` | Link creation time |

**Indexes:**
- `UNIQUE` on `(file_id, entity_type, entity_id)`
- `idx_file_links_entity` on `(entity_type, entity_id)`
- `idx_file_links_file_id` on `file_id`

**Relationships:**
- `file_id` -> `files(id)` ON DELETE CASCADE
- `created_by` -> `users(id)` ON DELETE SET NULL

**RLS Policies:**
- SELECT: Authenticated users can read links for entities they have access to
- INSERT: Authenticated users
- DELETE: Link owner, entity owner, or admin

---

## file_type Enum

```sql
CREATE TYPE file_type AS ENUM (
  'image', 'document', 'video', 'audio', 'spreadsheet', 'other'
);
```

| Value | Hebrew | Accepted MIME Types |
|-------|--------|-------------------|
| `image` | תמונה | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| `document` | מסמך | `application/pdf`, `text/plain` |
| `video` | וידאו | `video/mp4`, `video/webm` |
| `audio` | שמע | `audio/mpeg`, `audio/wav` |
| `spreadsheet` | גיליון | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/csv` |
| `other` | אחר | Anything not matching above |

---

## Storage Structure

Files are organized in Supabase Storage with the following path convention:

```
bucket/
  entity_type/
    entity_id/
      uuid_filename.ext
```

**Example:**

```
uploads/
  task/
    550e8400-e29b-41d4.../
      a1b2c3d4_photo.jpg
      e5f6g7h8_document.pdf
  user/
    660f9500-f30c-52e5.../
      i9j0k1l2_avatar.webp
```

### Bucket Configuration

| Bucket | Public | Max Size | Allowed MIME |
|--------|--------|----------|-------------|
| `uploads` | No (signed URLs) | 10MB | Per project config |
| `avatars` | Yes (public URLs) | 2MB | `image/*` |
| `exports` | No | 50MB | `application/pdf`, `text/csv` |

---

## Upload Flow

```
1. Client validates (size, type)
    |
2. Upload to Supabase Storage
    |
3. INSERT into files table (metadata)
    |
4. INSERT into file_links table (entity association)
    |
5. (Optional) Generate thumbnail for images
```

### TypeScript: uploadFile()

```typescript
import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"

interface UploadFileInput {
  file: File
  entityType: string
  entityId: string
  label?: string
  userId: string
  bucket?: string
}

interface UploadResult {
  fileId: string
  fileUrl: string
  thumbnailUrl: string | null
}

export async function uploadFile(input: UploadFileInput): Promise<UploadResult> {
  const supabase = await createClient()
  const { file, entityType, entityId, label, userId, bucket = "uploads" } = input

  // 1. Validate
  const maxSize = 10 * 1024 * 1024 // 10MB default
  if (file.size > maxSize) {
    throw new Error("File exceeds maximum size limit")
  }

  // 2. Compute checksum for deduplication
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer)
  const checksum = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // 3. Check for existing file with same checksum
  const { data: existing } = await supabase
    .from("files")
    .select("id, file_url, thumbnail_url")
    .eq("checksum", checksum)
    .is("deleted_at", null)
    .single()

  let fileId: string
  let fileUrl: string
  let thumbnailUrl: string | null = null

  if (existing) {
    // Reuse existing file, just create a new link
    fileId = existing.id
    fileUrl = existing.file_url
    thumbnailUrl = existing.thumbnail_url
  } else {
    // 4. Upload to storage
    const ext = file.name.split(".").pop() ?? "bin"
    const fileName = `${randomUUID()}.${ext}`
    const filePath = `${entityType}/${entityId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) throw new Error(uploadError.message)

    // 5. Get URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)
    fileUrl = urlData.publicUrl

    // 6. Determine file_type
    const fileType = resolveFileType(file.type)

    // 7. Insert file record
    const { data: fileRecord, error: insertError } = await supabase
      .from("files")
      .insert({
        file_name: file.name,
        file_path: filePath,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
        file_type: fileType,
        storage_bucket: bucket,
        checksum,
        created_by: userId,
      })
      .select("id")
      .single()

    if (insertError) throw new Error(insertError.message)
    fileId = fileRecord.id
  }

  // 8. Create file link
  await linkFileToEntity({
    fileId,
    entityType,
    entityId,
    label,
    userId,
  })

  return { fileId, fileUrl, thumbnailUrl }
}

function resolveFileType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType === "application/pdf" || mimeType === "text/plain") return "document"
  if (mimeType.includes("spreadsheet") || mimeType === "text/csv") return "spreadsheet"
  return "other"
}
```

### linkFileToEntity()

```typescript
interface LinkInput {
  fileId: string
  entityType: string
  entityId: string
  label?: string
  sortOrder?: number
  userId?: string
}

export async function linkFileToEntity(input: LinkInput): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from("file_links").insert({
    file_id: input.fileId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    label: input.label ?? null,
    sort_order: input.sortOrder ?? 0,
    created_by: input.userId ?? null,
  })

  if (error) throw new Error(error.message)
}
```

### getFilesForEntity()

```typescript
interface EntityFile {
  id: string
  fileId: string
  fileName: string
  fileUrl: string
  thumbnailUrl: string | null
  mimeType: string
  fileType: string
  fileSize: number
  label: string | null
  sortOrder: number
  createdAt: string
}

export async function getFilesForEntity(
  entityType: string,
  entityId: string
): Promise<EntityFile[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("file_links")
    .select(`
      id,
      file_id,
      label,
      sort_order,
      created_at,
      file:files(
        file_name,
        file_url,
        thumbnail_url,
        mime_type,
        file_type,
        file_size
      )
    `)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("sort_order", { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((link) => ({
    id: link.id,
    fileId: link.file_id,
    fileName: link.file?.file_name ?? "",
    fileUrl: link.file?.file_url ?? "",
    thumbnailUrl: link.file?.thumbnail_url ?? null,
    mimeType: link.file?.mime_type ?? "",
    fileType: link.file?.file_type ?? "other",
    fileSize: link.file?.file_size ?? 0,
    label: link.label,
    sortOrder: link.sort_order,
    createdAt: link.created_at,
  }))
}
```

### deleteFile()

Soft-deletes a file and removes all its links.

```typescript
export async function deleteFile(fileId: string): Promise<void> {
  const supabase = await createClient()

  // Soft delete the file record
  const { error } = await supabase
    .from("files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", fileId)

  if (error) throw new Error(error.message)

  // Links will cascade or can be explicitly deleted
  await supabase
    .from("file_links")
    .delete()
    .eq("file_id", fileId)
}
```

---

## Thumbnails

Auto-generated for image uploads. Stored in the same bucket with a `thumb_` prefix.

```
uploads/task/entity-id/thumb_a1b2c3d4.webp   (200x200)
uploads/task/entity-id/a1b2c3d4.jpg           (original)
```

### Generation Options

| Approach | When |
|----------|------|
| Supabase Image Transformation | Supabase Pro plan -- use URL transforms |
| Edge Function | On upload, generate via sharp/libvips |
| Client-side | Generate before upload for preview |
| Deferred | Background job processes queue |

---

## Deduplication

The `checksum` column (SHA-256) enables file deduplication:

1. Before uploading, compute the file hash
2. Check if a file with the same checksum already exists
3. If yes, skip the storage upload and reuse the existing `files` record
4. Create a new `file_links` entry pointing to the existing file

This saves storage space when the same file is uploaded multiple times (e.g., a company logo used across entities).

```sql
-- Find duplicate files
SELECT checksum, COUNT(*) as count, array_agg(file_name) as names
FROM files
WHERE deleted_at IS NULL AND checksum IS NOT NULL
GROUP BY checksum
HAVING COUNT(*) > 1;
```

---

## Storage Cleanup

Scheduled job to permanently delete orphaned files from storage.

```typescript
export async function cleanupOrphanedFiles(retentionDays = 30): Promise<number> {
  const supabase = await createClient()
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

  // Find soft-deleted files past retention
  const { data: orphaned } = await supabase
    .from("files")
    .select("id, file_path, storage_bucket")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)

  if (!orphaned?.length) return 0

  let cleaned = 0
  for (const file of orphaned) {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(file.storage_bucket)
      .remove([file.file_path])

    if (!storageError) {
      // Hard delete from database
      await supabase.from("files").delete().eq("id", file.id)
      cleaned++
    }
  }

  return cleaned
}
```

---

## Security

### Signed URLs for Private Files

Files in private buckets require signed URLs with expiration:

```typescript
export async function getSignedUrl(
  bucket: string,
  filePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds)

  if (error) throw new Error(error.message)
  return data.signedUrl
}
```

### RLS Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `files` | Authenticated (non-deleted) | Authenticated | Owner or admin | Soft-delete: owner or admin |
| `file_links` | Authenticated | Authenticated | Owner or admin | Owner, entity owner, or admin |

### Client-Side Validation

Always validate before upload:

```typescript
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "סוג קובץ לא נתמך"
  }
  if (file.size > MAX_FILE_SIZE) {
    return "הקובץ חורג מהגודל המקסימלי (10MB)"
  }
  return null
}
```

---

## Hebrew Labels

| Term | Hebrew |
|------|--------|
| Files | קבצים |
| Upload file | העלאת קובץ |
| Download | הורדה |
| Delete file | מחיקת קובץ |
| Image | תמונה |
| Document | מסמך |
| File name | שם קובץ |
| File size | גודל קובץ |
| Uploaded by | הועלה על ידי |
| Upload date | תאריך העלאה |
| Drag and drop | גרור ושחרר |
| Unsupported file type | סוג קובץ לא נתמך |
| File too large | הקובץ חורג מהגודל המקסימלי |
| Main image | תמונה ראשית |
| Attachment | צרופה |
