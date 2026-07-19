"use client"

import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Icon } from "@/components/shared/Icon"
import { diffDays } from "./board-rules"

export interface PendingDateChange {
  kind: "move" | "resize"
  guestName: string
  /** Original state BEFORE the drag. */
  original: {
    checkIn: string
    checkOut: string
    roomLabel: string
  }
  /** Proposed state AFTER the drag. */
  proposed: {
    checkIn: string
    checkOut: string
    roomLabel: string
  }
}

function fmt(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`
}

interface DateChangeConfirmDialogProps {
  change: PendingDateChange | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation gate for any drag-driven date change (move or resize). Server
 * action is only dispatched after `onConfirm`. Cancel reverts fully (the
 * caller simply clears pending state).
 */
export function DateChangeConfirmDialog({
  change,
  onConfirm,
  onCancel,
}: DateChangeConfirmDialogProps) {
  useEffect(() => {
    if (!change) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
      if (e.key === "Enter") onConfirm()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [change, onConfirm, onCancel])

  return (
    <AnimatePresence>
      {change && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative z-10 w-full max-w-md rounded-2xl bg-card shadow-2xl ring-1 ring-black/5 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-primary px-5 py-4 text-primary-foreground">
              <h2 className="text-sm font-bold">
                {change.kind === "resize" ? "שינוי שהייה" : "העברת הזמנה"}
              </h2>
              <p className="text-[11.5px] text-primary-foreground/80 mt-0.5 truncate">
                {change.guestName}
              </p>
            </div>

            {/* Before / after */}
            <div className="p-5 space-y-3">
              <Row label="לפני" before={change.original} />
              <div className="flex items-center justify-center text-muted-foreground">
                <Icon name="arrow_downward" size="sm" />
              </div>
              <Row label="אחרי" before={change.proposed} highlight />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-accent/40 border-t border-border/20">
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[40px] px-4 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white/60 transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="btn btn-primary"
              >
                אישור שינוי
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function Row({
  label,
  before,
  highlight,
}: {
  label: string
  before: { checkIn: string; checkOut: string; roomLabel: string }
  highlight?: boolean
}) {
  const nights = diffDays(before.checkIn, before.checkOut)
  return (
    <div
      className={`rounded-xl p-3 text-[12px] ${
        highlight ? "bg-primary/5 ring-1 ring-primary/15" : "bg-accent/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-[11px] font-bold text-foreground tabular-nums">
          {nights} לילות
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 tabular-nums">
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground">כניסה</span>
          <span className="font-semibold">{fmt(before.checkIn)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground">יציאה</span>
          <span className="font-semibold">{fmt(before.checkOut)}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-muted-foreground">חדר</span>
          <span className="font-semibold truncate">{before.roomLabel}</span>
        </div>
      </div>
    </div>
  )
}
