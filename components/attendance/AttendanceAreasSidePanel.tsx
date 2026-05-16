"use client"

/**
 * AttendanceAreasSidePanel — standalone panel for managing attendance areas.
 * ──────────────────────────────────────────────────────────────────────
 * Internal state machine:
 *   • {kind:"list"}              → AttendanceAreasList
 *   • {kind:"create"}            → AttendanceAreaForm (no initialArea)
 *   • {kind:"edit", area}        → AttendanceAreaForm (initialArea populated)
 *   • {kind:"delete-blocked",…}  → "cannot delete — N users assigned" view
 *
 * Delete policy: block-on-link. We never cascade-delete from the UI; if
 * users are linked, the admin must re-assign them first. (The server still
 * supports cascade for future super-admin / API use — see §12.9.4 — but the
 * UI no longer exposes that path.)
 *
 * After save:
 *   • Refresh the list locally
 *   • Broadcast `attendance-areas-changed` event so any open AttendanceTab
 *     refreshes its picker dropdown
 */

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider"
import { AttendanceAreasList } from "@/components/attendance/AttendanceAreasList"
import { AttendanceAreaForm } from "@/components/attendance/AttendanceAreaForm"
import {
  deleteAttendanceArea,
  getAreaLinkedUsers,
  listAttendanceAreas,
} from "@/lib/actions/attendance-areas"
import type { AttendanceArea } from "@/lib/types/attendance"

interface LinkedUser {
  id: string
  full_name: string
}

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; area: AttendanceArea }
  | { kind: "delete-confirm"; area: AttendanceArea }
  | { kind: "delete-blocked"; area: AttendanceArea; linkedUsers: LinkedUser[] }

interface AttendanceAreasSidePanelProps {
  isOpen: boolean
  onClose: () => void
}

export function AttendanceAreasSidePanel({
  isOpen,
  onClose,
}: AttendanceAreasSidePanelProps) {
  const [mode, setMode] = useState<Mode>({ kind: "list" })
  const [areas, setAreas] = useState<AttendanceArea[]>([])
  const [loading, setLoading] = useState(false)
  const [openSync, setOpenSync] = useState(isOpen)
  const [reloadKey, setReloadKey] = useState(0)

  // Render-phase sync: when `isOpen` flips, reset internal state.
  if (isOpen !== openSync) {
    setOpenSync(isOpen)
    if (isOpen) {
      setMode({ kind: "list" })
      setAreas([])
      setLoading(true)
    }
  }

  // Async data fetch — refetch when panel opens or reloadKey bumps.
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    listAttendanceAreas()
      .then((rows) => {
        if (!cancelled) setAreas(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "שגיאה בטעינת אזורים",
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, reloadKey])

  // ── Handlers ───────────────────────────────────────────────

  const refreshList = () => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  const handleCreate = () => setMode({ kind: "create" })

  const handleEdit = (area: AttendanceArea) => setMode({ kind: "edit", area })

  // Block-on-link delete:
  //   1. Peek at linked users (no mutation).
  //   2. If any users are linked → switch the panel to delete-blocked mode
  //      so the admin sees exactly who must be re-assigned first.
  //   3. If none are linked → switch the panel to delete-confirm mode for
  //      an in-panel confirm-or-cancel (instead of a floating toast).
  const handleDelete = async (area: AttendanceArea) => {
    const linkedUsers = await getAreaLinkedUsers(area.id)
    if (linkedUsers.length > 0) {
      setMode({ kind: "delete-blocked", area, linkedUsers })
      return
    }
    setMode({ kind: "delete-confirm", area })
  }

  const handleConfirmDelete = async () => {
    if (mode.kind !== "delete-confirm") return
    const { area } = mode
    const res = await deleteAttendanceArea("", area.id)
    if (!res.success) {
      toast.error("error" in res ? res.error : "שגיאה במחיקה")
      return
    }
    toast.success(`האזור "${area.name}" נמחק`)
    document.dispatchEvent(new CustomEvent("attendance-areas-changed"))
    refreshList()
    setMode({ kind: "list" })
  }

  const handleFormSaved = () => {
    refreshList()
    setMode({ kind: "list" })
  }

  const handleFormCancel = () => setMode({ kind: "list" })

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="אזורי דיווח"
      subtitle="הגדר מיקומים שבהם עובדים יכולים להחתים נוכחות"
      widthClass="w-full sm:w-[min(900px,90vw)]"
    >
      <GoogleMapsProvider>
        {mode.kind === "list" && (
          <AttendanceAreasList
            areas={areas}
            loading={loading}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        {mode.kind === "create" && (
          <AttendanceAreaForm
            onSaved={handleFormSaved}
            onCancel={handleFormCancel}
          />
        )}
        {mode.kind === "edit" && (
          <AttendanceAreaForm
            initialArea={mode.area}
            onSaved={handleFormSaved}
            onCancel={handleFormCancel}
          />
        )}
        {mode.kind === "delete-confirm" && (
          <DeleteConfirm
            area={mode.area}
            onConfirm={handleConfirmDelete}
            onCancel={() => setMode({ kind: "list" })}
          />
        )}
        {mode.kind === "delete-blocked" && (
          <DeleteBlocked
            area={mode.area}
            linkedUsers={mode.linkedUsers}
            onClose={() => setMode({ kind: "list" })}
          />
        )}
      </GoogleMapsProvider>
    </SidePanel>
  )
}

/* ── Delete-confirm view (no linked users) ──────────────────── */

interface DeleteConfirmProps {
  area: AttendanceArea
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

function DeleteConfirm({ area, onConfirm, onCancel }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          מחיקת אזור &quot;{area.name}&quot;
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          אין עובדים משויכים לאזור הזה.
        </p>
      </div>

      <div className="rounded-[20px] border border-[#fecaca] bg-[#fef2f2] p-5 flex items-start gap-3">
        <span className="shrink-0 w-10 h-10 rounded-full bg-white border border-[#fecaca] flex items-center justify-center text-[#b91c1c]">
          <Icon name="delete" size="md" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#b91c1c]">
            האם למחוק את האזור &quot;{area.name}&quot;?
          </p>
          <p className="text-xs text-[#7f1d1d] mt-1">
            הפעולה היא soft-delete — האזור ייעלם מהרשימה אבל יישמר ב-DB
            לצורכי היסטוריה.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[#dad9e3] text-[#6b6280] font-bold text-sm hover:bg-[#f4f2fc] transition-colors min-h-[44px] disabled:opacity-50"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={deleting}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#b91c1c] text-white font-bold text-sm hover:bg-[#991b1b] transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="delete" size="sm" />
          {deleting ? "מוחק..." : "מחק אזור"}
        </button>
      </div>
    </div>
  )
}

/* ── Delete-blocked view ─────────────────────────────────────── */

interface DeleteBlockedProps {
  area: AttendanceArea
  linkedUsers: LinkedUser[]
  onClose: () => void
}

function DeleteBlocked({ area, linkedUsers, onClose }: DeleteBlockedProps) {
  const count = linkedUsers.length

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          לא ניתן למחוק את האזור &quot;{area.name}&quot;
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {count === 1 ? "עובד אחד משויך" : `${count} עובדים משויכים`} לאזור.
          יש להסיר את השיוך לפני שניתן למחוק.
        </p>
      </div>

      <div className="rounded-[20px] border border-[#fecaca] bg-[#fef2f2] p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-10 h-10 rounded-full bg-white border border-[#fecaca] flex items-center justify-center text-[#b91c1c]">
            <Icon name="block" size="md" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#b91c1c]">
              {count === 1 ? "עובד משויך" : `${count} עובדים משויכים`} לאזור
            </p>
            <p className="text-xs text-[#7f1d1d] mt-1">
              כדי למחוק את האזור, פתח את כרטיס {count === 1 ? "העובד" : "כל אחד מהעובדים"} שלמטה ו:
            </p>
            <ul className="text-xs text-[#7f1d1d] mt-1 mr-4 list-disc space-y-0.5">
              <li>שייך אותו לאזור אחר, או</li>
              <li>שנה את רמת חובת הדיווח שלו ל-״ללא״ או ״ללא מיקום״.</li>
            </ul>
          </div>
        </div>

        <ul className="bg-white rounded-xl border border-[#fecaca] divide-y divide-[#fecaca] max-h-[260px] overflow-y-auto">
          {linkedUsers.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground"
            >
              <Icon name="person" size="sm" className="text-[#9ca3af]" />
              {u.full_name}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[#dad9e3] text-[#6b6280] font-bold text-sm hover:bg-[#f4f2fc] transition-colors min-h-[44px]"
        >
          סגור
        </button>
      </div>
    </div>
  )
}
