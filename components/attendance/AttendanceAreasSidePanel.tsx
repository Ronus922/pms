"use client"

/**
 * AttendanceAreasSidePanel — standalone panel for managing attendance areas.
 * ──────────────────────────────────────────────────────────────────────
 * Internal state machine:
 *   • {kind:"list"}          → AttendanceAreasList
 *   • {kind:"create"}        → AttendanceAreaForm (no initialArea)
 *   • {kind:"edit", area}    → AttendanceAreaForm (initialArea populated)
 *
 * After save:
 *   • Refresh the list locally
 *   • Broadcast `attendance-areas-changed` event so any open AttendanceTab
 *     refreshes its picker dropdown
 */

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { SidePanel } from "@/components/shared/SidePanel"
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider"
import { AttendanceAreasList } from "@/components/attendance/AttendanceAreasList"
import { AttendanceAreaForm } from "@/components/attendance/AttendanceAreaForm"
import {
  deleteAttendanceArea,
  listAttendanceAreas,
} from "@/lib/actions/attendance-areas"
import type { AttendanceArea } from "@/lib/types/attendance"

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; area: AttendanceArea }

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

  const handleDelete = (area: AttendanceArea) => {
    // Iteration 1b: simple delete with cascade=true. Cascade-aware UX
    // (modal showing affected users) arrives in iteration 3.
    toast(`למחוק את האזור "${area.name}"?`, {
      description: "עובדים המקושרים לאזור ינותקו ממנו.",
      duration: 10_000,
      action: {
        label: "מחק",
        onClick: async () => {
          const res = await deleteAttendanceArea("", area.id, {
            confirmCascade: true,
          })
          if (!res.success) {
            toast.error("error" in res ? res.error : "שגיאה במחיקה")
            return
          }
          toast.success(`האזור "${area.name}" נמחק`)
          document.dispatchEvent(new CustomEvent("attendance-areas-changed"))
          refreshList()
        },
      },
      cancel: {
        label: "ביטול",
        onClick: () => undefined,
      },
    })
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
      </GoogleMapsProvider>
    </SidePanel>
  )
}
