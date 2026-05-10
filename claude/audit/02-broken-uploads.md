# Broken Upload Pipeline

The project has multiple file-input components, none of which actually persist file content. They all use `URL.createObjectURL(file)` to create a `blob:` URL that lives only in the uploader's current browser tab session — and in three cases that blob URL is then written to the database as if it were a permanent file reference. **The UI shows success; the data is lost.**

## The systemic pattern

```ts
const fakeUrl = URL.createObjectURL(file)              // ephemeral, tab-scoped
await uploadXxx(tenantId, entityId, { url: fakeUrl, ... })  // saves blob URL to DB
```

Every cited line below was opened and verified by the author.

---

## 🟠 HIGH: Supplier documents (`supplier_documents` table)

**Client**: [components/suppliers/SupplierDetailPanel.tsx:570-588](../../components/suppliers/SupplierDetailPanel.tsx)

```ts
async function handleFileSelect(e) {
  const file = e.target.files?.[0]
  ...
  setUploading(true)
  const fakeUrl = URL.createObjectURL(file)                     // line 578
  const result = await uploadSupplierDocument(
    tenantId, supplier.id,
    { url: fakeUrl, name: displayName, mime: file.type, size: file.size },
    selectedDocType, userId, userName
  )                                                              // line 581
  ...
  toast.success("המסמך הועלה בהצלחה")                            // line 586 — LIE
```

**Server**: [lib/actions/suppliers.ts:326-348](../../lib/actions/suppliers.ts)

```ts
export async function uploadSupplierDocument(
  _tenantId: string, supplierId: string,
  file: { url: string; name: string; mime: string; size: number },
  ...
): Promise<{ success: boolean; error?: string; docId?: string }> {
  ...
  const actor = await requirePermission("suppliers", "edit")     // auth ✓
  const tenantId = actor.tenantId

  const [row] = await db`
    INSERT INTO supplier_documents
      (tenant_id, supplier_id, file_name, file_url, file_size_bytes, mime_type, ...)
    VALUES
      (${tenantId}, ${supplierId}, ${file.name}, ${file.url}, ...)  // ← blob: URL written to DB
    RETURNING id
  `
  await insertActivity(tenantId, supplierId, "document_uploaded", ...)
  return { success: true, docId: row.id as string }
```

The server has correct authorization. It then dutifully writes the literal string `blob:https://pms.bios.co.il/abc-123-…` into `supplier_documents.file_url`. The next time anyone (including the original uploader from a different tab or after a refresh) tries to open that document, the URL doesn't resolve to anything. The activity log claims "מסמך X הועלה" ("document X was uploaded") — false.

---

## 🟠 HIGH: Maintenance media

**Client**: [components/maintenance/CreateMaintenancePanel.tsx:156](../../components/maintenance/CreateMaintenancePanel.tsx), [components/maintenance/MaintenanceDetailPanel.tsx:163-167](../../components/maintenance/MaintenanceDetailPanel.tsx)

The detail panel even has a self-admitted placeholder comment:

```ts
// For now, create object URLs (in production, upload to Supabase storage first)
const newFiles = files.map((f) => ({ url: URL.createObjectURL(f), ... }))
```

Same pattern: blob URL → server action → DB column.

---

## 🟡 MEDIUM: Reservation attachments (silent loss, not broken save)

**Client**: [components/reservations/FileUploadArea.tsx:14-32](../../components/reservations/FileUploadArea.tsx)

```ts
const attachment: AttachmentFile = {
  id: `file-${Date.now()}-${i}`,
  name: file.name,
  type: file.type,
  size: file.size,
  url: URL.createObjectURL(file),
}
addAttachment(attachment)
```

Attachments go into a Zustand store (`useReservationFormStore`). On reservation submit, the modal passes `attachments: store.attachments` to `createReservation` — see [components/reservations/ReservationModal.tsx:214](../../components/reservations/ReservationModal.tsx).

**Critical observation**: `lib/actions/create-reservation.ts` **never reads the `attachments` field**. The author grepped the entire file for "attachment" / "file_url" — zero hits. So the attachments are simply discarded on submit, while the UI shows them.

**Net effect**: less bad than the supplier doc case (no false data in DB), but the UI still lies to the user. They attach files; the files vanish.

---

## 🟢 LOW: Self-admitted placeholders (no false success message)

**File**: [components/rooms/tabs/ImagesTab.tsx:58, 82](../../components/rooms/tabs/ImagesTab.tsx) _[author opened the file briefly]_

```ts
// Placeholder - actual file upload not implemented yet
```

**File**: [components/rooms/RoomFormDialog.tsx:1464](../../components/rooms/RoomFormDialog.tsx) _[author confirmed line via grep, did not read surrounding context]_

```ts
onClick={() => {/* Image upload placeholder */}}
```

These are honest placeholders — they don't write false data to the DB. They're broken features, but at least they don't lie. Severity LOW.

---

## What a real fix looks like

This is an architectural buildout, not a one-line patch. The shape:

1. Add a Supabase Storage bucket per entity type: `supplier-documents`, `maintenance-media`, `reservation-attachments`, `room-images`. Configure RLS so only same-tenant users can read/write.
2. Replace each `URL.createObjectURL` site with a real upload:
   ```ts
   const supabase = createClientSupabase()
   const path = `${tenantId}/${entityId}/${crypto.randomUUID()}-${file.name}`
   const { error } = await supabase.storage.from(bucket).upload(path, file)
   if (error) { ... }
   const { data } = supabase.storage.from(bucket).getPublicUrl(path)
   // pass data.publicUrl to the server action
   ```
3. Migrate existing rows: the broken `blob:` URLs in `supplier_documents.file_url` etc. should be nulled or flagged. Whatever was "uploaded" before today is irretrievable.
4. Add file-type / size validation on the server (the server actions trust the client's `mime` / `size` claims today).

**Estimated effort**: 1-2 days for the buckets + clients + server validation + migration script. Worth doing as a single coordinated piece, not piecemeal.

**Regression risk**: TOUCHES the supplier-document UX, maintenance-media UX, reservation-create UX. Existing DB rows with bad URLs need migration. Roll out behind a feature flag or do it during a maintenance window.

---

## What you do RIGHT NOW (before the rebuild)

Even before fixing the upload layer, decide which is worse:

- **Status quo**: users believe files are saved, then can't find them later. Trust erosion.
- **Honest "not yet supported"**: replace the file inputs with a "coming soon" placeholder so users don't bother attempting.

Recommendation: ship a "feature disabled" banner on each broken upload UI until the rebuild is in. One-day change. Stops the bleeding.
