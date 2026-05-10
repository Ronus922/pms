# Flow: Update Record (Standard)

This is the reference flow for editing any existing record. All modules follow this pattern unless explicitly documented otherwise.

## Actors

- Any authenticated user with `[module]:edit` permission

## Preconditions

1. User is authenticated
2. User has `[module]:edit` permission
3. Record exists and is not soft-deleted
4. Record status allows editing (not in a locked status)

## Flow

### Step 1: Open Record

- **Actor:** User
- **Action:** Clicks a row in the DataTable, or clicks "Edit" in the row action menu
- **Guard:** Row click opens in view mode; edit button opens in edit mode

### Step 2: SidePanel Opens with Existing Data

- **Actor:** System
- **Action:** SidePanel slides in from the left (RTL)
- **Data loading:**
  1. Show skeleton layout immediately (matching field positions)
  2. Fetch record via `get[Module]ById(id)` server action
  3. Populate all fields with existing values
  4. Apply field states (editable / read-only / locked / warning / hidden) based on:
     - User role and permissions
     - Record source (internal vs external/channel)
     - Record status
  5. Remove skeleton, show populated form
- **Mode:** Edit (tabs layout, not wizard)

### Step 3: Dirty State Tracking Begins

- **Actor:** System
- **Action:** Form state manager (Zustand store) records the initial values
- **Tracking:** Every field change is compared against initial values
- **Dirty indicator:** Panel header shows subtle "unsaved changes" indicator when dirty

### Step 4: User Modifies Fields

- **Actor:** User
- **Action:** Changes one or more field values

**Field interaction rules:**
- Editable fields: normal interaction
- Locked fields: show lock icon with tooltip explaining why (e.g., "שדה זה מנוהל מהערוץ")
- Warning fields: show yellow border; on change, show confirmation: "שינוי שדה זה עלול לגרום לאי-התאמה מול הערוץ. להמשיך?"
- Read-only fields: displayed as text, no input element rendered

**Validation behavior:**
- Same as create flow: blur validation, change validation with debounce
- Additional: some fields may have edit-specific validation (e.g., "cannot change date to past")

### Step 5: User Saves

- **Actor:** User
- **Action:** Clicks "Save" in footer
- **Optimization:** Only changed fields are sent to the server (partial update)
- **Button state:** Disabled if no changes (not dirty) or validation errors exist

### Step 6: Client-Side Validation

- **Actor:** System (client)
- **Action:** Zod partial schema validation on changed fields only
- **Schema:** `[module]UpdateSchema` from `lib/validations/[module].ts`

**Decision point:**
- **Passes** --> Go to Step 7
- **Fails** --> Show inline errors, stay on panel

### Step 7: Server Action Call

- **Actor:** System (client to server)
- **Action:** Calls `update[Module](id, changedFields)` server action
- **UI state:** Same as create flow (loading spinner, fields disabled)

### Step 8: Server-Side Processing

- **Actor:** System (server)
- **Action sequence:**

```
8a. Authenticate user
    --> Fail: return { success: false, error: 'unauthorized' }

8b. Check permission ([module]:edit)
    --> Fail: return { success: false, error: 'forbidden' }

8c. Fetch current record from DB
    --> Not found: return { success: false, error: 'not_found' }

8d. Check record is editable (status, ownership rules)
    --> Locked: return { success: false, error: 'record_locked', message: '...' }

8e. Validate changed fields with Zod
    --> Fail: return { success: false, error: 'validation', fields: {...} }

8f. Check for concurrent edit conflicts (optional)
    --> Conflict: return { success: false, error: 'conflict', serverData: {...} }

8g. Database update (only changed fields + updated_at)
    --> Fail: return { success: false, error: 'db_error' }

8h. Return { success: true, data: updatedRecord }
```

### Step 9: Handle Response

**Decision point:**

#### Success --> Step 10

#### Validation Error (8e)
- Map errors to form fields
- Re-enable form
- Panel stays open

#### Record Locked (8d)
- Show toast: "לא ניתן לערוך רשומה זו"
- Close panel
- Refresh list

#### Conflict (8f) -- Concurrent Edit
- Show dialog: "הרשומה עודכנה על ידי משתמש אחר. לרענן?"
- Options:
  - "Refresh" -- reload record data, user re-applies changes
  - "Override" -- force save (admin only)
  - "Cancel" -- discard changes

#### Not Found (8c)
- Show toast: "הרשומה לא נמצאה"
- Close panel
- Refresh list (record may have been deleted)

#### Database Error (8g)
- Show toast: "שגיאה בעדכון הנתונים"
- Re-enable form for retry
- Panel stays open

### Step 10: Success

- **Actor:** System (client)
- **Actions:**
  1. Show success toast: "[ENTITY] עודכן בהצלחה"
  2. Close SidePanel
  3. Refresh list data
  4. Updated record reflects changes in list immediately

### Step 11: Side Effects (Async)

- Audit log entry: user, action, timestamp, changed fields with old and new values
- Notifications to relevant users (if configured)
- n8n webhook (if configured)
- Related entity updates (if applicable)

## Unsaved Changes Protection

### Scenario: User clicks X (close) while dirty

```
1. System shows confirmation dialog:
   Title: "שינויים שלא נשמרו"
   Message: "יש שינויים שלא נשמרו. לצאת בלי לשמור?"
   Actions: [ביטול (stay)] [צא בלי לשמור (discard)]

2a. User clicks "stay" --> Dialog closes, panel stays open
2b. User clicks "discard" --> Panel closes, changes lost
```

### Scenario: User clicks outside panel while dirty

- Panel stays open (click-outside-to-close is disabled when dirty)

### Scenario: User navigates via browser back/forward while dirty

- `beforeunload` event shows browser's native confirmation dialog

## Optimistic UI (Optional, Per Module)

For simple field updates (e.g., status change), the module may implement optimistic updates:

```
1. User changes status
2. UI immediately reflects new status
3. Server action fires in background
4. If server fails --> revert UI to previous state + show error toast
```

## Error Recovery Summary

| Error Type | User Experience | Recovery |
|------------|----------------|----------|
| Client validation | Inline errors | Fix fields and retry |
| Server validation | Inline errors | Fix fields and retry |
| Permission denied | Toast + close | Contact admin |
| Record locked | Toast + close | Wait for unlock or contact admin |
| Concurrent conflict | Dialog with options | Refresh or override |
| Record not found | Toast + close | Record was deleted |
| Database error | Toast, retry available | Click save again |
| Network error | Toast with retry | Click save again |
