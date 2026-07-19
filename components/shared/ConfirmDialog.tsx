"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Icon } from "@/components/shared/Icon"

interface ConfirmOptions {
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

/**
 * תחליף מעוצב ל-window.confirm — RTL, טוקנים, נגיש.
 * שימוש:
 *   const { confirm, confirmDialog } = useConfirm()
 *   if (!(await confirm({ message: "למחוק?", danger: true }))) return
 *   ... ולרנדר {confirmDialog} פעם אחת בקומפוננטה.
 *
 * מרונדר דרך portal ל-body — backdrop-blur/transform על אב (SidePanel)
 * יוצרים containing block ש"כולא" position:fixed בתוכו.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const pendingRef = useRef<PendingConfirm | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    // בקשה חדשה מעל דיאלוג פתוח — הישן נסגר כ"בוטל", לא נתקע לעולם
    pendingRef.current?.resolve(false)
    return new Promise<boolean>((resolve) => {
      const entry = { ...opts, resolve }
      pendingRef.current = entry
      setPending(entry)
    })
  }, [])

  const close = useCallback((ok: boolean) => {
    const p = pendingRef.current
    pendingRef.current = null
    setPending(null)
    p?.resolve(ok)
  }, [])

  // Unmount בזמן שהדיאלוג פתוח (למשל סגירת ה-SidePanel המארח) — לשחרר את ה-await
  useEffect(() => {
    return () => {
      pendingRef.current?.resolve(false)
      pendingRef.current = null
    }
  }, [])

  const confirmDialog = pending ? (
    <ConfirmDialogView pending={pending} onClose={close} />
  ) : null

  return { confirm, confirmDialog }
}

function ConfirmDialogView({
  pending,
  onClose,
}: {
  pending: PendingConfirm
  onClose: (ok: boolean) => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const invoker = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()

    // Capture-phase: לתפוס Escape לפני מאזין ה-Escape של SidePanel, ו-focus trap בין שני הכפתורים
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        e.preventDefault()
        onClose(false)
        return
      }
      if (e.key === "Tab") {
        e.preventDefault()
        const next =
          document.activeElement === cancelRef.current ? confirmRef.current : cancelRef.current
        next?.focus()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      invoker?.focus?.()
    }
  }, [onClose])

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={pending.title ?? pending.message}
    >
      <button
        type="button"
        aria-label="ביטול"
        tabIndex={-1}
        onClick={() => onClose(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-default"
      />
      <div className="relative bg-card rounded-[20px] shadow-2xl border border-border/40 p-6 w-full max-w-sm space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              pending.danger
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            <Icon name={pending.danger ? "warning" : "help"} size="md" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            {pending.title && (
              <h3 className="text-base font-bold text-foreground mb-1">{pending.title}</h3>
            )}
            <p className="text-sm text-foreground/90 whitespace-pre-line">{pending.message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false)}
            className="min-h-[44px] px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {pending.cancelLabel ?? "ביטול"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onClose(true)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              pending.danger
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {pending.confirmLabel ?? "אישור"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
