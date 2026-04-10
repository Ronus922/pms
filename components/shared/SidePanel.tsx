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
            className="absolute inset-y-0 left-0 w-[55%] max-sm:w-full flex flex-col shadow-2xl rounded-tr-[0.65rem] rounded-br-[0.65rem] bg-card/90 backdrop-blur-xl dark:bg-card/90"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* Header — dark blue gradient */}
            <div className="relative bg-gradient-to-l from-[#003aa0] to-[#3F51B5] px-6 py-4 rounded-tr-[0.65rem] shrink-0">
              {/* Close button — always visible, top-left */}
              <button
                onClick={onClose}
                className="absolute left-4 top-4 z-10 p-1.5 rounded-xl bg-white/20 hover:bg-white/40 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
              <h2 className="text-lg font-bold text-white text-right font-headline">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-blue-100 mt-1 text-right">
                  {subtitle}
                </p>
              )}
            </div>

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
