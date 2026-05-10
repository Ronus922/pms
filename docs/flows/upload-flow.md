# Flow: File Upload (Standard)

This is the reference flow for uploading files (images, documents, PDFs) attached to any entity. Uses Supabase Storage as the backend.

## Actors

- Any authenticated user with edit permission on the parent entity

## Preconditions

1. User is authenticated
2. User has `[module]:edit` or `[module]:create` permission
3. Parent entity exists (for edit mode) or is being created (for create mode)
4. Supabase Storage bucket is configured for this entity type

## Configuration

### Per-Module Upload Config

```typescript
interface UploadConfig {
  bucket: string                    // Supabase storage bucket name
  allowedTypes: string[]            // MIME types: ['image/jpeg', 'image/png', 'application/pdf']
  maxFileSize: number               // In bytes (e.g., 5 * 1024 * 1024 = 5MB)
  maxFiles: number                  // Max files per entity (e.g., 10)
  generateThumbnails: boolean       // Auto-generate thumbnails for images
  path: (entityId: string) => string // Storage path pattern
}
```

### Default Limits

| Property | Default | Notes |
|----------|---------|-------|
| Max file size | 5MB | Per file |
| Max files per entity | 10 | Total count |
| Allowed image types | jpeg, png, webp | No gif, no svg |
| Allowed document types | pdf | Add more per module |
| Thumbnail size | 200x200 | Auto-generated for images |

## Flow

### Step 1: Upload Zone Display

- **Actor:** System
- **Location:** Within SidePanel, in a dedicated "Attachments" or "Files" section
- **Display:**
  ```
  +------------------------------------------+
  |                                          |
  |     [cloud upload icon]                  |
  |                                          |
  |     גרור קבצים לכאן או לחץ לבחירה       |
  |                                          |
  |     JPG, PNG, PDF | עד 5MB              |
  |                                          |
  +------------------------------------------+
  ```
- **Existing files:** Listed below the drop zone as thumbnail cards (images) or file rows (documents)

### Step 2: File Selection

- **Actor:** User
- **Action:** One of:
  - Drags files into the drop zone
  - Clicks the drop zone to open file browser
  - Pastes from clipboard (images only)

### Step 3: Client-Side Validation

- **Actor:** System (client)
- **Checks (per file):**

| Check | Failure Message (Hebrew) |
|-------|-------------------------|
| File type allowed | "סוג קובץ לא נתמך. השתמש ב-JPG, PNG או PDF" |
| File size within limit | "הקובץ גדול מדי. גודל מקסימלי: 5MB" |
| Total file count within limit | "ניתן להעלות עד [N] קבצים" |
| File not corrupted (can read) | "לא ניתן לקרוא את הקובץ" |

**Decision point:**
- **All files valid** --> Go to Step 4
- **Some files invalid** --> Show error per invalid file, valid files proceed to Step 4
- **All files invalid** --> Show errors, no upload starts

### Step 4: Preview Display

- **Actor:** System (client)
- **Action:** Show preview for each valid file:

**Images:**
```
+--------+  filename.jpg
|  thumb  |  2.3 MB
|  image  |  [=====>    ] 45%     [X remove]
+--------+
```

**Documents:**
```
[PDF icon]  document.pdf
            1.1 MB
            [=====>    ] 45%     [X remove]
```

- Thumbnail generated client-side for images (using canvas)
- Progress bar shows 0% initially
- Remove button available before and during upload

### Step 5: Upload to Storage

- **Actor:** System (client to server)
- **Action:** Upload each file to Supabase Storage
- **Method:** Direct upload via Supabase client SDK (signed URL or direct bucket upload)
- **Path:** `[bucket]/[entity_type]/[entity_id]/[uuid]_[sanitized_filename]`

**Per-file upload process:**
```
5a. Generate unique filename (uuid prefix to prevent collisions)
5b. Start upload with progress tracking
5c. Update progress bar in real-time
5d. On complete: get public URL
5e. Generate thumbnail (server-side, if configured)
```

**Parallel uploads:** Up to 3 files upload simultaneously. Remaining files queued.

### Step 6: Store File Reference in Database

- **Actor:** System (server)
- **Action:** Insert file metadata into `entity_files` table

```sql
INSERT INTO entity_files (
  entity_type,    -- '[module]'
  entity_id,      -- parent entity UUID
  file_name,      -- original filename
  file_path,      -- storage path
  file_url,       -- public URL
  file_size,      -- bytes
  mime_type,      -- 'image/jpeg'
  thumbnail_url,  -- thumbnail URL (if image)
  uploaded_by,    -- auth.uid()
  created_at      -- now()
)
```

### Step 7: Display Uploaded File

- **Actor:** System (client)
- **Action:** Replace progress bar with completed state:

**Images:**
```
+--------+  filename.jpg
|  thumb  |  2.3 MB  [checkmark]
|  image  |  Uploaded           [eye] [download] [trash]
+--------+
```

**Documents:**
```
[PDF icon]  document.pdf
            1.1 MB  [checkmark]
            Uploaded              [eye] [download] [trash]
```

**Actions available:**
- Eye icon: preview in lightbox (images) or new tab (documents)
- Download icon: download file
- Trash icon: delete file (with confirmation)

### Step 8: Upload During Entity Creation (Special Case)

When uploading files while creating a new entity (before it has an ID):

```
8a. Files uploaded to a temp path: [bucket]/temp/[session_id]/[filename]
8b. File references stored in the form's Zustand store (not DB yet)
8c. On entity save: server action moves files to permanent path
8d. File references inserted into entity_files with the new entity ID
8e. If user cancels creation: temp files cleaned up by scheduled task (24h TTL)
```

## File Deletion Flow

### Step D1: User Initiates Delete

- **Actor:** User
- **Action:** Clicks trash icon on a file

### Step D2: Confirmation

- **Actor:** System
- **Display:** Inline confirmation (not a dialog):
  ```
  "למחוק את הקובץ?"  [ביטול] [מחיקה]
  ```

### Step D3: Delete Execution

- **Actor:** System
- **Actions:**
  1. Delete from Supabase Storage (file + thumbnail)
  2. Delete row from `entity_files` table
  3. Remove from UI immediately

### Step D4: Error Handling

- If storage delete fails: log error, still remove DB reference (orphan file cleaned by scheduled task)
- If DB delete fails: show toast error, retry

## Error Handling

| Error | During | User Sees | Recovery |
|-------|--------|-----------|----------|
| Network timeout | Upload | "העלאה נכשלה" + retry button per file | Click retry |
| Storage full | Upload | "אין מספיק מקום אחסון" | Contact admin |
| Auth expired | Upload | "הפג תוקף ההתחברות" | Re-authenticate |
| File corrupted | Upload | "הקובץ פגום" | Upload different file |
| Rate limit | Upload | "יותר מדי בקשות. נסה שוב בעוד דקה" | Wait and retry |

## Security Considerations

1. **File type validation:** Check MIME type AND file extension AND magic bytes (server-side)
2. **Filename sanitization:** Remove special characters, limit length, add UUID prefix
3. **Path traversal prevention:** Never use user-supplied paths
4. **Storage RLS:** Users can only access files for entities they have permission to view
5. **Signed URLs:** Use time-limited signed URLs for private files (expiry: 1 hour)
6. **Virus scanning:** Consider integrating ClamAV for uploaded documents (out of scope for MVP)

## Storage Structure

```
[bucket]/
  [entity_type]/
    [entity_id]/
      [uuid]_filename.jpg          -- original
      [uuid]_filename_thumb.jpg    -- thumbnail (200x200)
  temp/
    [session_id]/
      [uuid]_filename.jpg          -- temp files during creation
```

## Responsive Behavior

| Breakpoint | Upload Zone | File List |
|------------|-------------|-----------|
| Desktop (>= 1024px) | Full width drop zone | Grid of thumbnails (3 per row) |
| Tablet (768-1023px) | Full width drop zone | Grid (2 per row) |
| Mobile (< 768px) | Tap to upload (no drag) | Stacked list |
