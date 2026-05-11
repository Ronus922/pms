# SidePanel: [ENTITY_NAME]

## Panel Info

| Property | Value |
|----------|-------|
| Entity | [ENTITY_NAME] |
| Component | `[Entity]Panel.tsx` |
| Config | `[Entity]PanelConfig.ts` |
| Width | 55% (desktop) / 100% (mobile) |
| Direction | Opens from left (RTL) |
| Modes | create / edit / view |

## Header

| Element | Create Mode | Edit Mode | View Mode |
|---------|------------|-----------|-----------|
| Title | [HEBREW_CREATE_TITLE] | [HEBREW_EDIT_TITLE] | [HEBREW_VIEW_TITLE] |
| Subtitle | - | [Entity identifier, e.g., name or ID] | [Entity identifier] |
| Status badge | - | [Status with border color] | [Status with border color] |
| Close button | X icon (top-left, RTL) | X icon | X icon |

## Layout Structure

### Mode: Create (Wizard)

| Step | Label (Hebrew) | Icon | Fields |
|------|---------------|------|--------|
| 1 | [STEP_1_LABEL] | [ICON] | [field1, field2, ...] |
| 2 | [STEP_2_LABEL] | [ICON] | [field1, field2, ...] |
| 3 | [STEP_3_LABEL] | [ICON] | [field1, field2, ...] |
| 4 | [REVIEW_LABEL] | [ICON] | Read-only summary of all steps |

### Mode: Edit/View (Tabs)

| Tab | Label (Hebrew) | Icon | Sections |
|-----|---------------|------|----------|
| 1 | [TAB_1_LABEL] | [ICON] | [section1, section2] |
| 2 | [TAB_2_LABEL] | [ICON] | [section1, section2] |
| 3 | [TAB_3_LABEL] | [ICON] | [section1, section2] |

## Sections

### Section: [SECTION_NAME]

| Property | Value |
|----------|-------|
| Title (Hebrew) | [HEBREW_TITLE] |
| Collapsible | [Yes / No] |
| Default state | [Open / Collapsed] |
| Grid | [1-col / 2-col / custom] |

## Fields

### [SECTION_NAME] Fields

| Field | Label (Hebrew) | Type | Required | Default | Validation | Width |
|-------|---------------|------|----------|---------|------------|-------|
| [FIELD_1] | [HEBREW] | text | Yes | - | min 2 chars | full |
| [FIELD_2] | [HEBREW] | select | Yes | - | from lookup | half |
| [FIELD_3] | [HEBREW] | date | No | today | future only | half |
| [FIELD_4] | [HEBREW] | number | Yes | 0 | min 0 | half |
| [FIELD_5] | [HEBREW] | textarea | No | - | max 500 chars | full |
| [FIELD_6] | [HEBREW] | toggle | No | false | - | half |

### Field Type Reference

| Type | Component | Notes |
|------|-----------|-------|
| text | Input | Standard text input |
| select | Select/Combobox | From lookup_items or custom options |
| date | DatePicker | Hebrew locale, RTL calendar |
| number | Input type=number | With increment/decrement buttons |
| textarea | Textarea | Auto-resize, character counter |
| toggle | Switch | Boolean on/off |
| phone | Input + format | Auto-format Israeli phone |
| email | Input | Email validation |
| currency | Input + prefix | ILS prefix, 2 decimal places |
| file | FileUpload | Drag zone with preview |
| multi-select | MultiSelect | Tags/chips display |

## Footer

### Create Mode

| Button | Label (Hebrew) | Position | Variant | Action |
|--------|---------------|----------|---------|--------|
| Cancel | ביטול | Right (RTL) | ghost | Close panel, discard |
| Back | חזרה | Right | outline | Previous step (steps 2+) |
| Next | המשך | Left | default | Next step (not last) |
| Save | שמירה | Left | default | Submit form (last step) |

### Edit Mode

| Button | Label (Hebrew) | Position | Variant | Action |
|--------|---------------|----------|---------|--------|
| Cancel | ביטול | Right | ghost | Close panel, discard changes |
| Save | שמירה | Left | default | Submit changes |
| Delete | מחיקה | Left | destructive | Confirm then delete |

### View Mode

| Button | Label (Hebrew) | Position | Variant | Action |
|--------|---------------|----------|---------|--------|
| Close | סגירה | Right | ghost | Close panel |
| Edit | עריכה | Left | default | Switch to edit mode |

## Conditional Visibility

| Condition | Affected Fields | Behavior |
|-----------|----------------|----------|
| [FIELD_X] === [VALUE] | [field_a, field_b] | Show fields |
| [FIELD_X] !== [VALUE] | [field_a, field_b] | Hide fields |
| mode === 'view' | All fields | Read-only display |
| [STATUS] === 'completed' | [field_a] | Lock field |

## Field Locking Rules

| Source | Locked Fields | Reason | Override |
|--------|--------------|--------|----------|
| External (channel) | [FIELD_LIST] | Synced from channel | Admin only |
| Status: completed | [FIELD_LIST] | Record is finalized | Super admin only |
| Time: > 24h | [FIELD_LIST] | Edit window expired | Admin only |

## Dirty State Handling

| Scenario | Behavior |
|----------|----------|
| User modifies field then clicks X | Show confirmation dialog: "יש שינויים שלא נשמרו. לצאת בכל זאת?" |
| User modifies field then clicks outside | Panel stays open (click-outside disabled when dirty) |
| User navigates away (browser) | beforeunload warning |

## Loading States

| State | Display |
|-------|---------|
| Panel opening | Skeleton layout matching field positions |
| Saving | Footer button shows spinner, fields disabled |
| Deleting | Confirmation dialog, then spinner |
| Field loading (async options) | Individual field skeleton |

## Responsive Behavior

| Breakpoint | Panel Width | Layout Changes |
|------------|-------------|----------------|
| >= 1024px | 55% | 2-column grid for fields |
| 768-1023px | 75% | 2-column grid |
| < 768px | 100% (fullscreen) | 1-column grid, stacked |
