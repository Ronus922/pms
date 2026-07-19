"use client"

import { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Icon } from "@/components/shared/Icon"

type TargetChoice = "room" | "area"

interface AddTargetDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelectRoom: () => void
  onSelectArea: () => void
}

export function AddTargetDialog({ isOpen, onClose, onSelectRoom, onSelectArea }: AddTargetDialogProps) {
  const [selected, setSelected] = useState<TargetChoice | null>(null)

  useEffect(() => {
    if (isOpen) setSelected(null)
  }, [isOpen])

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [isOpen, handleKey])

  function handleConfirm() {
    if (!selected) return
    onClose()
    if (selected === "room") onSelectRoom()
    else onSelectArea()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/65"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-[472px] bg-background shadow-lg border rounded-lg overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="הוספת חדר / אזור"
          >
            {/* Header */}
            <div className="bg-primary px-6 py-4 relative">
              <button
                onClick={onClose}
                className="absolute left-4 top-4 p-1.5 rounded-xl bg-white/20 hover:bg-white/40 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="סגור"
              >
                <Icon name="close" size="sm" className="text-primary-foreground" />
              </button>
              <h2 className="text-lg font-bold text-primary-foreground font-headline">הוספת חדר / אזור</h2>
              <p className="text-sm text-primary-foreground/80 mt-1">יצירת יעד תפעולי חדש במערכת</p>
            </div>

            {/* Body */}
            <div className="px-6 pt-5 pb-2 space-y-4">
              <p className="text-sm font-bold text-muted-foreground">בחר סוג יעד:</p>

              <div className="grid grid-cols-2 gap-3">
                {/* Room card */}
                <button
                  type="button"
                  onClick={() => setSelected("room")}
                  className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all min-h-[44px] ${
                    selected === "room"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/40 bg-accent hover:border-primary/30"
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    selected === "room" ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <Icon name="bed" size="lg" className={selected === "room" ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${selected === "room" ? "text-primary" : "text-foreground"}`}>חדר</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">חדר אירוח / שינה</p>
                  </div>
                </button>

                {/* Area card */}
                <button
                  type="button"
                  onClick={() => setSelected("area")}
                  className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all min-h-[44px] ${
                    selected === "area"
                      ? "border-violet-500 bg-violet-500/5 shadow-sm"
                      : "border-border/40 bg-accent hover:border-violet-300"
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    selected === "area" ? "bg-violet-500/10" : "bg-muted"
                  }`}>
                    <Icon name="meeting_room" size="lg" className={selected === "area" ? "text-violet-600" : "text-muted-foreground"} />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${selected === "area" ? "text-violet-600" : "text-foreground"}`}>אזור</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">לובי, מסדרון, חניה...</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-start gap-2 px-6 py-4 border-t border-slate-100 bg-card">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selected}
                className="btn btn-primary"
              >
                המשך
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline"
              >
                ביטול
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
