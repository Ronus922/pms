# Calendar Resize Preview — Binding Rule

> **Status:** Permanent. Non-negotiable.
> **Scope:** `/calendar` board, reservation drag/resize.
> **Added:** 2026-04-19
> **Module owner:** Calendar

---

## The rule

During `drag.type === "resize"` on a reservation segment:

1. **The committed reservation bar never changes.**
   It stays at its original position, original width, **100% opacity**, with the guest-name text unmoved. No stretching, no shrinking, no reflow, no dimming, no transform.
2. **The resize feedback is a delta-only overlay**, rendered alongside the committed bar on the same row.
3. **Only the delta region changes visually while the user drags** — the area between the original end and the target end.
4. **Database commit happens only on mouse release.** Until then the reservation in state is the pre-drag reservation.
5. **Zero-delta moment = no overlay.** When the cursor hasn't crossed a cell boundary yet, the preview returns `null` — the user sees the committed bar alone.
6. **Invalid resize stays in the delta region.** A conflict / LOS / capacity violation shows the delta overlay in a stronger red with the violation reason — **never** a full-replacement red bar over the whole target span.
7. **Never regress to full-replacement preview bars.** Any future preview layer added to this board must render as a separate layer and leave the committed bar untouched.

---

## Why this rule exists

Previously the move/resize preview was a full pill rendered at the target position, with the committed bar dimmed to 40 % opacity underneath. Visually the dimmed bar + opaque preview read as "the reservation just grew into those cells" — even though the DOM width was stable. This created three concrete problems:

- Users reported that the bar "stretched during drag" even though no DOM width actually changed.
- Guest-name text inside the committed pill appeared to shift because the dim + overlay broke the continuity.
- Invalid previews blanketed the entire target span, so a user resizing a bar into a conflict couldn't see where the conflict started.

Delta-only preview fixes all three: the committed pill is the persisted state, the overlay is the draft intent, the two never overlap on the original span.

---

## Architecture

| Layer | File | Responsibility |
|---|---|---|
| Committed bar | [`components/calendar/board/BoardBody.tsx`](../../components/calendar/board/BoardBody.tsx) | Renders `ReservationBlock` from the server's segment dates. Sets `isDragged` **only** when `drag.type === "move"` — never on resize. |
| Committed bar | [`components/calendar/board/ReservationBlock.tsx`](../../components/calendar/board/ReservationBlock.tsx) | Width comes **only** from the `startOffsetCols / endOffsetCols` props. No drag-state-dependent width math. |
| Preview overlay | [`components/calendar/board/PreviewLayer.tsx`](../../components/calendar/board/PreviewLayer.tsx) | Delta-only overlay for resize. Separate branch for move (which uses its own captured fractional geometry, see move rule). |
| State machine | [`components/calendar/board/use-board-interaction.ts`](../../components/calendar/board/use-board-interaction.ts) | `startResize` captures `originalStartCol` + `originalNights`; `onMove` updates `newStartCol` + `newNights`; `onUp` commits via `onResize`. |
| State shape | [`components/calendar/board/board-types.ts`](../../components/calendar/board/board-types.ts) | `DragState["resize"]` = `{ segmentId, edge, roomId, originalStartCol, originalNights, newStartCol, newNights, invalid?, reason? }`. |
| Server commit | [`lib/actions/board-actions.ts`](../../lib/actions/board-actions.ts) — `resizeReservationSegment` | Re-validates availability + capacity before persisting the new dates. Client state is never trusted. |

---

## Exact delta formula (PreviewLayer, resize branch)

```ts
const originalEnd   = drag.originalStartCol + drag.originalNights
const newEnd        = drag.newStartCol      + drag.newNights
const extending     = newEnd > originalEnd
const deltaFromCol  = Math.min(originalEnd, newEnd)
const deltaWidthCols = Math.abs(newEnd - originalEnd)

if (deltaWidthCols === 0) return null              // no visible delta yet

palette = drag.invalid ? strong-red
        : extending    ? green
                       : red

insetInlineStart: pct(deltaFromCol)
width:            pct(deltaWidthCols)
label:            `${extending ? "+" : "-"}${deltaWidthCols} · ${drag.newNights} לילות`
```

The start edge is locked by a separate project rule, so `drag.newStartCol === drag.originalStartCol` in practice — the delta math collapses to end-edge resize only.

---

## Resize states

| State | What the user sees | Preview layer |
|---|---|---|
| idle | Committed bar at full opacity. | none |
| resize, delta = 0 | Committed bar at full opacity. | none (returns `null`) |
| resize, extending, valid | Committed bar unchanged + green overlay outside the committed end edge, labelled `+N · M לילות`. | delta-only |
| resize, shortening, valid | Committed bar unchanged + red overlay inside the committed end region, labelled `-N · M לילות`. | delta-only |
| resize, invalid | Committed bar unchanged + strong-red overlay on the delta region + violation reason. | delta-only |
| release (valid) | Committed bar replaced by new dates after server returns. | none |
| release (invalid) | Drag state → idle, committed bar unchanged. Toast/message explains the violation. | none |
| Escape pressed mid-drag | Drag state → idle, overlay disappears, committed bar unchanged. | none |

---

## Examples

### Extend a 3-night reservation to 5 nights

```
cols:    0  1  2  3  4  5  6
commit:  [────────]          committed bar, opacity 100%, cols [0,3)
overlay:          [───]      green overlay, cols [3,5), "+2 · 5 לילות"
```

### Shorten a 3-night reservation to 1 night

```
cols:    0  1  2  3  4  5  6
commit:  [────────]          committed bar, opacity 100%, cols [0,3)
overlay:    [─────]          red overlay, cols [1,3), "-2 · 1 לילות"
```

### Extend a 1-night reservation to 2 nights

```
cols:    0  1  2  3  4
commit:  [──]                committed bar, opacity 100%, cols [0,1)
overlay:    [──]             green overlay, cols [1,2), "+1 · 2 לילות"
```

### Invalid extension (conflict on next cell)

```
cols:    0  1  2  3  4  5
commit:  [────────]          committed bar, opacity 100%, cols [0,3)
overlay:          [─]        strong-red overlay, cols [3,4), "התנגשות עם הזמנה" (reason from server/client validator)
```

---

## Verification checklist

Run through this before merging any change to the calendar drag/resize surface:

- [ ] `BoardBody.tsx`: `isDragged` is scoped to `drag.type === "move"` only.
- [ ] `ReservationBlock.tsx`: bar `width` / `insetInlineStart` are derived from props only — no reading from drag state.
- [ ] `PreviewLayer.tsx`: resize branch returns `null` when `deltaWidthCols === 0`.
- [ ] `PreviewLayer.tsx`: resize branch never sets `width: pct(drag.newNights)` directly — it uses the delta formula.
- [ ] `use-board-interaction.ts`: `startResize` captures both `originalStartCol` and `originalNights`.
- [ ] `use-board-interaction.ts`: drag state reverts to `idle` on Escape + on release (both valid and invalid paths).
- [ ] Invalid resize shows the delta region in strong-red only — no full-span red bar.
- [ ] Server re-validates in `resizeReservationSegment` before committing new dates.
- [ ] Hover tooltip behaviour on the committed bar is unchanged while resizing.
- [ ] Single-night and multi-night reservations behave identically under the rule.

---

## Related rules

- **Move preview**: the move overlay uses the *committed bar's captured fractional geometry* (`srcStartFraction`, `srcWidthCols`) — not whole nights — so it never appears wider than the source bar.
- **Start edge lock**: only the end edge is resizable. The start edge is locked by `useBoardInteraction.startResize` (`if (edge !== "end") return`).
- **Server as source of truth**: every commit re-validates via `check_room_availability()` + capacity + LOS. The client preview never bypasses the server check.
