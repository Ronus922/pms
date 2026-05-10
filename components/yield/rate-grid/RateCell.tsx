"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/shared/Icon"
import type { RateGridField } from "@/lib/actions/rate-grid"

export type CellKind = "number" | "boolean"

interface Props {
  kind: CellKind
  field: RateGridField
  value: number | boolean | null
  isOverride: boolean
  saving?: boolean
  onCommit: (value: number | boolean | null) => Promise<void> | void
  placeholder?: string
}

/**
 * A single editable cell inside the rate grid.
 * - Numbers open a text input on click. Blur / Enter commits, Esc cancels.
 * - Booleans toggle on click (no input — one-click toggle).
 * - Cells with an override draw a subtle primary-colored dot.
 */
export function RateCell({
  kind,
  value,
  isOverride,
  saving,
  onCommit,
  placeholder = "—",
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  if (kind === "boolean") {
    const boolValue = Boolean(value)
    return (
      <button
        type="button"
        onClick={() => onCommit(!boolValue)}
        disabled={saving}
        className={`relative h-full w-full min-h-[36px] text-[11px] font-bold flex items-center justify-center transition-colors border-b border-border/10 ${
          boolValue
            ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
            : "text-muted-foreground hover:bg-accent"
        } ${saving ? "opacity-50" : ""}`}
        title={boolValue ? "סגור — לחץ כדי לפתוח" : "פתוח — לחץ כדי לסגור"}
      >
        {boolValue ? <Icon name="block" size="sm" /> : <span>—</span>}
      </button>
    )
  }

  // number kind
  const display =
    value === null || value === undefined ? placeholder : String(value)

  const startEdit = () => {
    if (saving) return
    setDraft(value === null || value === undefined ? "" : String(value))
    setEditing(true)
  }

  const commit = async () => {
    const trimmed = draft.trim()
    const next = trimmed === "" ? null : Number(trimmed)
    setEditing(false)
    if (trimmed !== "" && (Number.isNaN(next) || (next as number) < 0)) return
    const prev = value
    if (next === prev) return
    await onCommit(next)
  }

  const cancel = () => {
    setEditing(false)
    setDraft("")
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          } else if (e.key === "Escape") {
            e.preventDefault()
            cancel()
          }
        }}
        className="h-full w-full min-h-[36px] text-[11px] font-bold text-center bg-primary/10 border border-primary/40 outline-none border-b border-border/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={saving}
      className={`h-full w-full min-h-[36px] text-[11px] font-bold text-center transition-colors border-b border-border/10 hover:bg-accent ${
        isOverride ? "text-primary" : "text-foreground"
      } ${value === null ? "text-muted-foreground/60" : ""} ${
        saving ? "opacity-50" : ""
      }`}
      title="לחץ כדי לערוך"
    >
      {display}
    </button>
  )
}
