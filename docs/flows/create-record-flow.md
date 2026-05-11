# Flow: Create Record (Standard)

This is the reference flow for creating any new record in the system. All modules follow this pattern unless explicitly documented otherwise.

## Actors

- Any authenticated user with `[module]:create` permission

## Preconditions

1. User is authenticated
2. User has `[module]:create` permission
3. User is on the module's list page

## Flow

### Step 1: Initiate Creation

- **Actor:** User
- **Action:** Clicks the "Create" / "+" button on the list page
- **Location:** Top-right area of the page header (RTL: top-left visually)
- **Guard:** Button is only rendered if user has `[module]:create` permission

### Step 2: SidePanel Opens

- **Actor:** System
- **Action:** SidePanel slides in from the left side (RTL)
- **Width:** 55% on desktop, 100% on mobile
- **Mode:** Create (wizard steps or single form, per module spec)
- **Initial state:** All fields empty or with defaults from module config
- **Focus:** First input field receives focus automatically

### Step 3: User Fills Form

- **Actor:** User
- **Action:** Fills in required and optional fields

**Validation behavior:**
- Required fields: validated on blur (show error after first interaction)
- Format validation: runs on change with debounce (e.g., email format, phone format)
- Cross-field validation: runs when dependent field changes
- Error display: inline below the field, Hebrew error message, red border

**Wizard mode (multi-step):**
- Steps displayed as stepper in header (flex-row-reverse for RTL)
- "Next" button validates current step fields before advancing
- "Back" button preserves entered data
- Step indicator shows completed/current/upcoming
- User can click completed step indicators to go back

### Step 4: User Submits

- **Actor:** User
- **Action:** Clicks "Save" button in the panel footer
- **Button state:** Disabled if form has validation errors

### Step 5: Client-Side Validation

- **Actor:** System (client)
- **Action:** Full Zod schema validation runs on all fields
- **Schema:** Shared schema from `lib/validations/[module].ts`

**Decision point:**
- **Validation passes** --> Go to Step 6
- **Validation fails** --> Show all errors inline, scroll to first error, stay on panel. Do NOT proceed to server.

### Step 6: Server Action Call

- **Actor:** System (client to server)
- **Action:** Calls `create[Module]` server action with validated data
- **UI state during call:**
  - Footer button shows loading spinner
  - All form fields become disabled
  - Panel cannot be closed (X button disabled)

### Step 7: Server-Side Processing

- **Actor:** System (server)
- **Action sequence:**

```
7a. Authenticate user (getAuthUser)
    --> Fail: return { success: false, error: 'unauthorized' }

7b. Check permission ([module]:create)
    --> Fail: return { success: false, error: 'forbidden' }

7c. Validate data with Zod (same schema as client)
    --> Fail: return { success: false, error: 'validation', fields: {...} }

7d. Business logic validation (custom rules)
    --> Fail: return { success: false, error: 'business_rule', message: '...' }

7e. Database insert via Supabase
    --> Fail: return { success: false, error: 'db_error' }

7f. Return { success: true, data: newRecord }
```

### Step 8: Handle Response

- **Actor:** System (client)

**Decision point:**
- **Success** --> Go to Step 9
- **Server validation error** --> Go to Step 8a
- **Permission error** --> Go to Step 8b
- **Database error** --> Go to Step 8c

#### Step 8a: Server Validation Error

- Map server field errors back to form fields
- Show inline errors
- Re-enable form for editing
- Panel stays open

#### Step 8b: Permission Error

- Show toast: "אין לך הרשאה לבצע פעולה זו"
- Close panel
- Refresh page (permissions may have changed)

#### Step 8c: Database Error

- Show toast: "שגיאה בשמירת הנתונים. נסה שוב."
- Re-enable form for retry
- Panel stays open
- Log error to monitoring (Sentry)

### Step 9: Success

- **Actor:** System (client)
- **Actions (all happen):**
  1. Show success toast: "[ENTITY] נוצר בהצלחה" (2 seconds, auto-dismiss)
  2. Close SidePanel with slide-out animation
  3. Refresh list data (revalidatePath or query invalidation)
  4. New record appears in list (top if sorted by created_at desc)

### Step 10: Side Effects (Async)

- **Actor:** System (background)
- **Actions (module-dependent):**
  - Audit log entry created (user, action, timestamp, data)
  - Email notification sent (if configured for this module)
  - n8n webhook triggered (if configured)
  - Related entity statuses updated (if applicable)

## Error Recovery Summary

| Error Type | User Experience | System Action |
|------------|----------------|---------------|
| Client validation | Inline errors, panel stays open | None |
| Server validation | Inline errors, panel stays open | None |
| Permission denied | Toast + panel closes | Log attempt |
| Database error | Toast, panel stays open for retry | Log to Sentry |
| Network error | Toast "בעיית תקשורת", retry button | Log to Sentry |
| Timeout (> 10s) | Toast "הפעולה לוקחת זמן", retry option | Log to monitoring |

## Data Flow Diagram

```
[User Input]
    |
    v
[Zustand Form Store] -- holds wizard state across steps
    |
    v
[Zod Client Validation]
    |
    +--> FAIL --> [Show Inline Errors]
    |
    v PASS
[Server Action]
    |
    v
[Auth Check] --> [Permission Check] --> [Zod Server Validation] --> [Business Rules] --> [DB Insert]
    |                |                        |                          |                    |
    v FAIL           v FAIL                   v FAIL                     v FAIL               v FAIL
[401 Response]   [403 Response]         [422 Response]            [422 Response]         [500 Response]
    |                |                        |                          |                    |
    v                v                        v                          v                    v
[Toast + Close]  [Toast + Close]        [Inline Errors]           [Toast + Stay]        [Toast + Retry]
```
