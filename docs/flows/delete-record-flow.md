# Flow: Delete Record (Standard)

This is the reference flow for deleting any record. The system uses **soft delete** (setting `deleted_at` timestamp) for all entities. Hard deletes are never performed from the UI.

## Actors

- Any authenticated user with `[module]:delete` permission

## Preconditions

1. User is authenticated
2. User has `[module]:delete` permission
3. Record exists and is not already soft-deleted
4. Record status allows deletion (not in a protected status)

## Flow

### Step 1: Initiate Delete

- **Actor:** User
- **Action:** One of:
  - Clicks "Delete" in the row action dropdown menu (DataTable)
  - Clicks "Delete" button in the SidePanel footer (edit mode)
- **Guard:** Delete action is only rendered if user has `[module]:delete` permission AND record status allows deletion

### Step 2: Confirmation Dialog

- **Actor:** System
- **Action:** Shows a centered confirmation dialog (this is the ONE exception to the SidePanel-only rule)
- **Dialog content:**

```
+------------------------------------------+
|          מחיקת [ENTITY_TYPE]              |
|                                          |
|  האם למחוק את [ENTITY_IDENTIFIER]?      |
|                                          |
|  [Warning about consequences]            |
|                                          |
|  Related data impact:                    |
|  - [N] related [ENTITY_TYPE_B] records   |
|  - [Impact description]                  |
|                                          |
|          [ביטול]    [מחיקה]              |
+------------------------------------------+
```

**Dialog details:**
- Title: "מחיקת [entity type in Hebrew]"
- Entity identifier: name, number, or other human-readable ID
- Warning text: describes what happens to related data
- Cancel button (ghost variant): closes dialog, no action
- Delete button (destructive variant): red, proceeds with deletion

### Step 3: Critical Entity Typed Confirmation (Optional)

For high-impact entities (e.g., deleting a guest with reservations, deleting a room), add a typed confirmation step:

```
+------------------------------------------+
|          מחיקת [ENTITY_TYPE]              |
|                                          |
|  פעולה זו אינה ניתנת לביטול.             |
|  הקלד "[ENTITY_NAME]" לאישור:           |
|                                          |
|  [___________________________]           |
|                                          |
|          [ביטול]    [מחיקה]              |
+------------------------------------------+
```

- Delete button is disabled until typed text matches exactly
- Case-insensitive comparison

**Decision point:**
- **User confirms** --> Go to Step 4
- **User cancels** --> Dialog closes, no action taken

### Step 4: Server Action Call

- **Actor:** System (client to server)
- **Action:** Calls `delete[Module](id)` server action
- **UI state:**
  - Delete button in dialog shows loading spinner
  - Cancel button is disabled
  - Dialog cannot be dismissed

### Step 5: Server-Side Processing

- **Actor:** System (server)
- **Action sequence:**

```
5a. Authenticate user
    --> Fail: return { success: false, error: 'unauthorized' }

5b. Check permission ([module]:delete)
    --> Fail: return { success: false, error: 'forbidden' }

5c. Fetch record, verify it exists and is not already deleted
    --> Not found or already deleted: return { success: false, error: 'not_found' }

5d. Check deletion rules:
    - Status allows deletion?
    - Ownership rules pass? (if staff can only delete own records)
    - Time-based rules pass? (if deletion window applies)
    --> Blocked: return { success: false, error: 'delete_blocked', message: '...' }

5e. Check cascading impact:
    - Are there related records that depend on this record?
    - Can those relationships be safely handled?
    --> If blocking dependency exists: return { success: false, error: 'has_dependencies', deps: [...] }

5f. Soft delete: UPDATE [table] SET deleted_at = now() WHERE id = [id]
    --> Fail: return { success: false, error: 'db_error' }

5g. Handle related records (per module rules):
    - Cascade soft delete related records? (rare)
    - Nullify foreign keys?
    - Leave as-is with orphan handling?

5h. Return { success: true, data: { id, deleted_at } }
```

### Step 6: Handle Response

**Decision point:**

#### Success --> Go to Step 7

#### Permission Error (5b)
- Close dialog
- Show toast: "אין לך הרשאה למחוק רשומה זו"

#### Not Found (5c)
- Close dialog
- Show toast: "הרשומה לא נמצאה"
- Refresh list

#### Delete Blocked (5d)
- Keep dialog open
- Show error in dialog: reason in Hebrew (e.g., "לא ניתן למחוק הזמנה בסטטוס פעיל")
- User can only click Cancel

#### Has Dependencies (5e)
- Show dependency list in dialog
- Example: "לא ניתן למחוק אורח זה. קיימות 3 הזמנות פעילות."
- User can only click Cancel

#### Database Error (5f)
- Close dialog
- Show toast: "שגיאה במחיקת הרשומה"

### Step 7: Success

- **Actor:** System (client)
- **Actions:**
  1. Close confirmation dialog
  2. Close SidePanel (if delete was triggered from panel)
  3. Show success toast with undo option:
     ```
     "[ENTITY_NAME] נמחק"    [ביטול מחיקה]     [X]
     ```
  4. Refresh list data (deleted record disappears)
  5. Undo option available for 5 seconds

### Step 8: Undo (Optional, within 5 seconds)

- **Actor:** User
- **Action:** Clicks "Undo" in the success toast
- **System action:**
  1. Call `restore[Module](id)` server action
  2. Server: UPDATE [table] SET deleted_at = null WHERE id = [id]
  3. Show toast: "[ENTITY_NAME] שוחזר"
  4. Refresh list (record reappears)

**If undo window expires:**
- Toast auto-dismisses
- Deletion is final (record still exists in DB with deleted_at set)

### Step 9: Side Effects (Async)

- Audit log entry: user, action = 'delete', timestamp, record_id
- Notification to admins (for critical entities)
- n8n webhook (if configured)
- Related records handled per module rules

## Deletion Rules by Entity Type

| Entity | Can Delete When | Cannot Delete When | Cascade Behavior |
|--------|----------------|-------------------|------------------|
| [ENTITY_1] | [CONDITIONS] | [CONDITIONS] | [BEHAVIOR] |
| [ENTITY_2] | [CONDITIONS] | [CONDITIONS] | [BEHAVIOR] |

## Error Recovery Summary

| Error Type | User Experience | Recovery |
|------------|----------------|----------|
| Permission denied | Toast | Contact admin |
| Not found | Toast + list refresh | Record already deleted |
| Delete blocked | Error in dialog | Resolve blocking condition first |
| Has dependencies | Dependency list in dialog | Delete/resolve dependencies first |
| Database error | Toast | Retry |
| Network error | Toast with retry | Click delete again |

## Important Notes

1. **Always soft delete** -- never `DELETE FROM`. Records with `deleted_at` are filtered out in all queries.
2. **Undo is client-side only** -- the toast with undo option is the recovery mechanism. After 5 seconds, the user must contact an admin to restore.
3. **Admin restore** -- super_admin can view deleted records in a "trash" view and restore them by setting `deleted_at = null`.
4. **Permanent purge** -- records older than [RETENTION_PERIOD] days can be permanently purged via a scheduled admin task (never from the UI).
