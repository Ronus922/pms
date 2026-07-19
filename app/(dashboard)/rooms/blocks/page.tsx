"use client"

/**
 * Room-block management page.
 *
 * Lists every date-ranged block for the tenant (active + expired + cancelled),
 * lets admins create / edit / cancel / delete. Cancellation is a soft delete
 * (is_active=false) so the audit trail stays intact; hard delete is only used
 * for rows created in error.
 *
 * Availability is derived entirely from the server action layer
 * (`lib/actions/room-blocks.ts`) — this page does not touch the DB directly.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { SidePanel } from "@/components/shared/SidePanel"
import { useConfirm } from "@/components/shared/ConfirmDialog"
import { toast } from "sonner"
import { FormField, inputClass, selectClass, textareaClass } from "@/components/shared/FormField"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import {
  listRoomBlocks,
  listRoomsForBlockSelect,
  createRoomBlock,
  updateRoomBlock,
  cancelRoomBlock,
  deleteRoomBlock,
  type RoomBlockRow,
  type RoomBlockType,
  type RoomForBlockSelect,
  type ReservationConflict,
} from "@/lib/actions/room-blocks"

/* ── Constants ──────────────────────────────────────────────── */

const BLOCK_TYPE_OPTIONS: { value: RoomBlockType; label: string }[] = [
  { value: "maintenance", label: "תחזוקה" },
  { value: "manual_block", label: "חסימה ידנית" },
  { value: "owner_use", label: "שימוש בעלים" },
  { value: "deep_cleaning", label: "ניקיון יסודי" },
  { value: "temporary_out_of_order", label: "לא תקין זמנית" },
  { value: "other", label: "אחר" },
]

const BLOCK_TYPE_LABEL: Record<RoomBlockType, string> = BLOCK_TYPE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<RoomBlockType, string>,
)

type LifeState = "active" | "future" | "expired" | "cancelled"

function getLifeState(block: RoomBlockRow, today: string): LifeState {
  if (!block.is_active) return "cancelled"
  if (block.end_date <= today) return "expired"
  if (block.start_date > today) return "future"
  return "active"
}

const LIFE_LABEL: Record<LifeState, string> = {
  active: "פעיל",
  future: "עתידי",
  expired: "הסתיים",
  cancelled: "מבוטל",
}

const LIFE_BORDER: Record<LifeState, string> = {
  active: "border-r-4 border-emerald-500",
  future: "border-r-4 border-sky-500",
  expired: "border-r-4 border-muted-foreground",
  cancelled: "border-r-4 border-destructive/60",
}

/* ── Page ───────────────────────────────────────────────────── */

export default function RoomBlocksPage() {
  const { tenantId } = useTenant()
  const { isAdmin } = usePermissions()

  const [blocks, setBlocks] = useState<RoomBlockRow[]>([])
  const [rooms, setRooms] = useState<RoomForBlockSelect[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<LifeState | "all">("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RoomBlockRow | null>(null)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const load = useCallback(async () => {
    setLoading(true)
    const [bs, rs] = await Promise.all([
      listRoomBlocks(tenantId, { includeExpired: true }),
      listRoomsForBlockSelect(tenantId),
    ])
    setBlocks(bs)
    setRooms(rs)
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (filter === "all") return blocks
    return blocks.filter((b) => getLifeState(b, today) === filter)
  }, [blocks, filter, today])

  const { confirm, confirmDialog } = useConfirm()

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(b: RoomBlockRow) {
    setEditing(b)
    setDialogOpen(true)
  }

  async function handleCancel(b: RoomBlockRow) {
    if (!(await confirm({ message: `לבטל את החסימה לחדר ${b.room_number}?`, confirmLabel: "בטל חסימה" }))) return
    const r = await cancelRoomBlock(tenantId, b.id)
    if (!r.success) {
      toast.error(r.error || "שגיאה")
      return
    }
    load()
  }

  async function handleDelete(b: RoomBlockRow) {
    if (
      !(await confirm({
        message: `למחוק לצמיתות את החסימה לחדר ${b.room_number}? פעולה זו אינה הפיכה.`,
        danger: true,
        confirmLabel: "מחק לצמיתות",
      }))
    )
      return
    const r = await deleteRoomBlock(tenantId, b.id)
    if (!r.success) {
      toast.error(r.error || "שגיאה")
      return
    }
    load()
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-headline">חסימות חדרים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ניהול חסימות תאריך-טווח: תחזוקה, חסימה ידנית, שימוש בעלים ועוד
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-bold bg-accent px-4 py-2 rounded-full tabular-nums">
            {filtered.length} חסימות
          </span>
          {isAdmin && (
            <button
              onClick={openNew}
              className="btn btn-primary"
            >
              <Icon name="add" size="sm" className="text-primary-foreground" />
              חסימה חדשה
            </button>
          )}
        </div>
      </div>

      {/* ── Filter pills ─────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ["all", "הכל"],
          ["active", "פעילות עכשיו"],
          ["future", "עתידיות"],
          ["expired", "הסתיימו"],
          ["cancelled", "מבוטלות"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-4 py-2 rounded-full text-xs font-bold min-h-[36px] transition-colors ${
              filter === k
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-accent text-muted-foreground hover:bg-border/40"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Icon name="event_busy" size="xl" className="opacity-30" />
          <p className="text-sm font-medium">אין חסימות להצגה</p>
        </div>
      ) : (
        <div className="bg-card rounded-[20px] border border-border/15 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/50">
                <tr className="text-right text-[12px] font-bold text-muted-foreground">
                  <th className="px-4 py-3">חדר</th>
                  <th className="px-4 py-3">מ־</th>
                  <th className="px-4 py-3">עד</th>
                  <th className="px-4 py-3">סוג</th>
                  <th className="px-4 py-3">סיבה</th>
                  <th className="px-4 py-3">סטטוס</th>
                  <th className="px-4 py-3">נוצר ע״י</th>
                  <th className="px-4 py-3">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const life = getLifeState(b, today)
                  return (
                    <tr
                      key={b.id}
                      className={`border-t border-border/15 hover:bg-accent/30 transition-colors ${LIFE_BORDER[life]}`}
                    >
                      <td className="px-4 py-3 font-bold">
                        {b.room_number}
                        {b.room_type_name && (
                          <span className="text-xs text-muted-foreground font-normal mr-2">
                            {b.room_type_name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{b.start_date}</td>
                      <td className="px-4 py-3 tabular-nums">{b.end_date}</td>
                      <td className="px-4 py-3">{BLOCK_TYPE_LABEL[b.block_type] || b.block_type}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {b.reason && b.reason !== "סגור" ? b.reason : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-bold ${
                            life === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : life === "future"
                                ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                                : life === "cancelled"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-accent text-muted-foreground"
                          }`}
                        >
                          {LIFE_LABEL[life]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {b.created_by_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <button
                              onClick={() => openEdit(b)}
                              className="w-9 h-9 rounded-lg bg-accent hover:bg-border/40 flex items-center justify-center"
                              title="ערוך"
                            >
                              <Icon name="edit" size="sm" />
                            </button>
                          )}
                          {isAdmin && b.is_active && (
                            <button
                              onClick={() => handleCancel(b)}
                              className="w-9 h-9 rounded-lg bg-accent hover:bg-amber-100 dark:hover:bg-amber-900/30 flex items-center justify-center"
                              title="בטל"
                            >
                              <Icon name="cancel" size="sm" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(b)}
                              className="w-9 h-9 rounded-lg bg-accent hover:bg-destructive/10 flex items-center justify-center text-destructive"
                              title="מחק"
                            >
                              <Icon name="delete" size="sm" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BlockDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        rooms={rooms}
        editing={editing}
        onSaved={() => {
          setDialogOpen(false)
          load()
        }}
      />
    </div>
  )
}

/* ── Dialog ─────────────────────────────────────────────────── */

function BlockDialog({
  isOpen,
  onClose,
  rooms,
  editing,
  onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  rooms: RoomForBlockSelect[]
  editing: RoomBlockRow | null
  onSaved: () => void
}) {
  const { tenantId } = useTenant()

  const [roomId, setRoomId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [blockType, setBlockType] = useState<RoomBlockType>("manual_block")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  /** Conflicts surfaced by the server (either after the soft-reject pass or
   *  after a committed save for informational purposes). When populated
   *  alongside `needsConfirmation`, the save button locks until the user
   *  ticks the explicit "I accept" checkbox. */
  const [conflicts, setConflicts] = useState<ReservationConflict[] | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [confirmOverlap, setConfirmOverlap] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setError("")
    setConflicts(null)
    setNeedsConfirmation(false)
    setConfirmOverlap(false)
    if (editing) {
      setRoomId(editing.room_id)
      setStartDate(editing.start_date)
      setEndDate(editing.end_date)
      setBlockType(editing.block_type)
      setReason(editing.reason && editing.reason !== "סגור" ? editing.reason : "")
      setNotes(editing.notes || "")
    } else {
      const today = new Date().toISOString().slice(0, 10)
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      setRoomId("")
      setStartDate(today)
      setEndDate(tomorrow)
      setBlockType("manual_block")
      setReason("")
      setNotes("")
    }
  }, [isOpen, editing])

  // Any edit to the fields invalidates a prior "confirm to override" state —
  // the admin must re-review the conflicts against the new range before
  // re-accepting. Prevents stale acknowledgement.
  useEffect(() => {
    if (!needsConfirmation) return
    setNeedsConfirmation(false)
    setConfirmOverlap(false)
    setConflicts(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the inputs, not the flag itself
  }, [roomId, startDate, endDate])

  function validate(): string | null {
    if (!roomId) return "חובה לבחור חדר"
    if (!startDate) return "חובה להזין תאריך התחלה"
    if (!endDate) return "חובה להזין תאריך סיום"
    if (endDate <= startDate) return "תאריך הסיום חייב להיות אחרי תאריך ההתחלה"
    return null
  }

  async function handleSave() {
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setError("")
    setSaving(true)
    const payload = {
      roomId,
      startDate,
      endDate,
      blockType,
      reason: reason || null,
      notes: notes || null,
    }
    const accept = confirmOverlap
    const r = editing
      ? await updateRoomBlock(tenantId, editing.id, payload, accept)
      : await createRoomBlock(tenantId, payload, accept)
    setSaving(false)

    // Soft-reject path — server refused to commit because of reservation
    // overlap, and the admin has NOT yet ticked the "I accept" checkbox.
    // Show the conflicts, surface the confirmation UI, and keep the dialog
    // open with save disabled until the admin explicitly opts in.
    if (!r.success && r.needsConfirmation) {
      setConflicts(r.reservationConflicts ?? null)
      setNeedsConfirmation(true)
      setError(r.error || "קיימת התנגשות עם הזמנה קיימת")
      return
    }

    if (!r.success) {
      setError(r.error || "שגיאה בשמירת החסימה")
      return
    }

    // Success: if the server returned conflicts (admin accepted an override),
    // surface them one last time as a reminder but close the dialog — the
    // block is already committed.
    if (r.reservationConflicts && r.reservationConflicts.length > 0) {
      setConflicts(r.reservationConflicts)
    }
    onSaved()
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "עריכת חסימה" : "חסימה חדשה"}
      subtitle="חסימת חדר לטווח תאריכים"
      footer={
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-card/80 backdrop-blur-sm border-t border-border/15">
          <button
            onClick={handleSave}
            disabled={saving || (needsConfirmation && !confirmOverlap)}
            className="btn btn-primary"
            title={
              needsConfirmation && !confirmOverlap
                ? "סמן את אישור ההתנגשות כדי להמשיך"
                : undefined
            }
          >
            {saving
              ? "שומר…"
              : needsConfirmation && confirmOverlap
                ? editing ? "עדכן למרות חפיפה" : "שמור למרות חפיפה"
                : editing
                  ? "עדכן"
                  : "שמור"}
            {!saving && <Icon name="check_circle" size="sm" />}
          </button>
          <button
            onClick={onClose}
            className="btn btn-outline"
          >
            ביטול
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <FormField label="חדר" required>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className={selectClass}
          >
            <option value="">בחר חדר</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.room_number} {r.room_type_name ? `— ${r.room_type_name}` : ""}
                {r.status !== "available" ? ` (${r.status})` : ""}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <FormField label="מתאריך" required>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="עד תאריך (לא כולל)" required>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>

        <FormField label="סוג חסימה" required>
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as RoomBlockType)}
            className={selectClass}
          >
            {BLOCK_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="סיבה (אופציונלי)">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="לדוגמה: החלפת מזגן, ציוד פגום"
            className={inputClass}
          />
        </FormField>

        <FormField label="הערות פנימיות (אופציונלי)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={textareaClass}
            placeholder="פרטים נוספים לצוות…"
          />
        </FormField>

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm flex items-center gap-3">
            <Icon name="error" size="sm" />
            {error}
          </div>
        )}

        {conflicts && conflicts.length > 0 && (
          <div
            className={`rounded-xl px-4 py-3 text-sm space-y-3 border ${
              needsConfirmation
                ? "bg-destructive/10 text-destructive border-destructive/40"
                : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40"
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              <Icon name={needsConfirmation ? "priority_high" : "warning"} size="sm" />
              {needsConfirmation
                ? `חסימה זו חופפת ל-${conflicts.length} הזמנה קיימת`
                : "החסימה נשמרה — שים לב להזמנות החופפות:"}
            </div>
            <ul className="space-y-1 mr-6 list-disc">
              {conflicts.map((c) => (
                <li key={c.reservation_id}>
                  {c.reservation_number || c.reservation_id} — {c.guest_name || "ללא שם"} ({c.check_in} → {c.check_out})
                </li>
              ))}
            </ul>
            {needsConfirmation && (
              <label className="flex items-start gap-2 cursor-pointer bg-card rounded-lg p-3 border border-destructive/30 min-h-[44px]">
                <input
                  type="checkbox"
                  checked={confirmOverlap}
                  onChange={(e) => setConfirmOverlap(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-destructive"
                />
                <span className="text-xs text-foreground leading-snug">
                  אני מאשר יצירת חסימה למרות שקיימת הזמנה חופפת — באחריותי.
                  {" "}ההזמנה לא תימחק אוטומטית; יש לתאם עם האורח / לבטל ידנית.
                </span>
              </label>
            )}
          </div>
        )}
      </div>
    </SidePanel>
  )
}
