"use client"

import { useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"

interface SidePanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Sticky footer rendered outside scroll area */
  footer?: React.ReactNode
  /** When true, children get full control (no p-6 wrapper) */
  noPadding?: boolean
  /** Optional Tailwind width override. Defaults to "w-[55%] max-sm:w-full". */
  widthClass?: string
  /** When true, suppress the default gradient header so caller can render its own. */
  hideDefaultHeader?: boolean
}

const DURATION = 0.4

export function SidePanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  noPadding,
  widthClass,
  hideDefaultHeader,
}: SidePanelProps) {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50" dir="rtl">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION, ease: "easeInOut" }}
            className="absolute inset-0 bg-black/65"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel — opens from LEFT in RTL */}
          <motion.aside
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: DURATION, ease: "easeInOut" }}
            className={`absolute inset-y-0 left-0 ${widthClass ?? "w-[55%] max-sm:w-full"} flex flex-col shadow-2xl rounded-tr-[0.65rem] rounded-br-[0.65rem] bg-card/90 backdrop-blur-xl dark:bg-card/90`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* Header — Azure Ethos blue (suppressed when hideDefaultHeader) */}
            {!hideDefaultHeader && (
              <div className="relative bg-primary border-b border-primary px-6 pt-14 pb-5 rounded-tr-[0.65rem] shrink-0">
                {/* Close button — SidePanel skill spec, top-left */}
                <button
                  onClick={onClose}
                  className="absolute left-4 top-4 z-10 p-1.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="סגור"
                >
                  <DotLottieReact
                    src="/lottie/menu-close.lottie"
                    loop={false}
                    autoplay
                    className="w-6 h-6"
                  />
                </button>

                {/* Title */}
                <h2 className="text-xl font-extrabold text-white text-right">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-sm text-white/70 mt-1 text-right">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Content */}
            <div className={`flex-1 min-h-0 text-right ${noPadding ? "overflow-hidden" : "overflow-y-auto p-6"}`}>
              {children}
            </div>

            {/* Sticky Footer */}
            {footer && (
              <div className="shrink-0">
                {footer}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
