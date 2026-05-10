# Interaction Rules

> All user interaction patterns, behaviors, and UX conventions.
> Every interactive element must follow these rules to ensure a predictable, consistent experience.

---

## 1. Navigation and Selection

### Row Click

Clicking a row in a table or a card in a grid opens the **SidePanel** with that entity's details in read mode.

```
User clicks row → SidePanel slides in from left → shows entity details (read-only tabs)
```

### Double Click

Double-clicking a row or card opens the entity in **edit mode** (if the user has edit permission). If the user lacks permission, nothing happens -- no disabled state, no error.

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Escape` | Closes the topmost panel, dropdown, or popover |
| `Tab` | Moves focus to the next interactive element |
| `Shift + Tab` | Moves focus to the previous interactive element |
| `Enter` | Submits forms, confirms dialogs, activates buttons |
| `Space` | Toggles checkboxes, activates buttons |

---

## 2. Panels and Overlays

### SidePanel Behavior

- Opens from the **left** side (RTL layout).
- Overlay (`bg-black/65`) covers the rest of the screen.
- Clicking the overlay does **NOT** close the panel. Use the X button or Escape.
- Only one SidePanel can be open at a time. Opening a new one replaces the current one.
- Panel remembers scroll position when switching between tabs within the same panel.

### Close Button

- Position: top-left corner of the panel header (RTL).
- Minimum size: 44x44px touch target.
- Visual: `rounded-xl bg-white/20 hover:bg-white/40` on the gradient header.

### Dropdowns and Popovers

- Clicking outside closes dropdowns and popovers.
- Clicking outside does **NOT** close SidePanels (use X or Escape).
- Popovers must position dynamically to avoid going off-screen.

---

## 3. Select and Dropdown Behavior

### Short Lists (10 items or fewer)

Standard dropdown with all items visible on open.

### Long Lists (more than 10 items)

Searchable dropdown with a text input at the top for filtering.

```tsx
// Example: searchable select for room list
<SearchableSelect
  options={rooms}
  placeholder="Search rooms..."
  onSelect={handleSelect}
/>
```

---

## 4. Forms and Saving

### Save and Cancel

- Save and Cancel buttons always appear in a **sticky footer** at the bottom of the panel.
- Save button: primary gradient style, positioned on the left (RTL).
- Cancel button: secondary outline style, positioned on the right (RTL).
- Save button is disabled while the form is submitting (shows a spinner).

### Validation

- Validate on blur for individual fields.
- Validate all fields on submit attempt.
- Show inline error messages below the field in `text-[11px] text-destructive`.
- Show a summary error banner at the top of the form if there are multiple errors.

### Inline Edit

Only use inline editing for:
- Quick toggles (on/off switches)
- Status changes (dropdown)
- Simple single-field updates

Full forms always use the SidePanel.

---

## 5. Feedback

### Success

Show a **toast notification** (bottom-center or top-center) for:
- Record created
- Record updated
- Record deleted
- Action completed

Toast auto-dismisses after 4 seconds. Includes a brief description of what happened.

### Errors

| Context | Feedback Type |
|---------|--------------|
| Form validation | Inline error below the field |
| Server action failure | Error banner at the top of the form |
| Network error | Toast with retry option |
| Permission denied | Toast with explanation |

**Rule:** Never show a success message without verifying the action completed. No fake confirmations.

### Info

Toast for informational messages (e.g., "Copied to clipboard").

---

## 6. Destructive Actions

### Confirmation Required

All destructive actions (delete, cancel reservation, remove user) require a confirmation dialog.

The dialog must:
- State exactly what will be deleted/removed.
- Use the entity name or identifier in the message.
- Have a clearly labeled destructive button (`bg-destructive text-white`).
- Have a cancel option that is visually distinct from the destructive action.

```tsx
// Example confirmation
"Are you sure you want to delete reservation #12345 for David Cohen?"
[Cancel] [Delete Reservation]
```

### No Silent Failures

If a destructive action fails, show an explicit error. Never silently swallow the error and leave the user thinking it succeeded.

---

## 7. Drag and Drop

Use drag and drop **only** for reordering items (e.g., task priority, column order).

Requirements:
- Visual drag handle icon visible on hover.
- Drop target highlighted during drag.
- Ghost/preview of the dragged item follows the cursor.
- Snap to valid drop positions.
- Cancel with Escape.

Do not use drag and drop for:
- Moving items between categories (use a select/dropdown instead).
- File uploads (use a dedicated drop zone component).

---

## 8. File Upload

- Dedicated drop zone with dashed border and upload icon.
- Supports both click-to-browse and drag-to-drop.
- Shows thumbnail previews for images.
- Shows file name and size for documents.
- Progress indicator during upload.
- Remove button on each uploaded file.

---

## 9. Mobile Touch Interactions

| Gesture | Action |
|---------|--------|
| Tap | Same as click |
| Long press | Opens context menu (where applicable) |
| Swipe left/right | Dismiss notifications, navigate between tabs |
| Pull down | Refresh data (where applicable) |

### Touch Targets

Every interactive element must be at least **44x44px**. This includes:
- Buttons
- Links
- Checkboxes
- Radio buttons
- Toggle switches
- Close buttons
- Menu items
- Tab headers

---

## 10. Loading States

| Duration | Behavior |
|----------|----------|
| < 300ms | No loading indicator (feels instant) |
| 300ms - 2s | Skeleton placeholders matching content shape |
| > 2s | Skeleton + subtle progress text |
| Action buttons | Spinner replaces button text, button disabled |

Never show a blank screen during loading. Always show either the previous content or skeleton placeholders.

---

## Related Documents

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) -- visual styles for all elements mentioned here
- [MOBILE_RULES.md](./MOBILE_RULES.md) -- mobile-specific layout rules
- [PERMISSIONS_RULES.md](./PERMISSIONS_RULES.md) -- what users can and cannot do
- [RESTRICTIONS_AND_PROHIBITIONS.md](./RESTRICTIONS_AND_PROHIBITIONS.md) -- prohibited patterns
