"use client"

import { useEffect, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"

interface FileViewerProps {
  isOpen: boolean
  onClose: () => void
  fileUrl: string
  fileName: string
  mimeType: string
}

export function FileViewer({ isOpen, onClose, fileUrl, fileName, mimeType }: FileViewerProps) {
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

  if (!isOpen) return null

  const isImage = mimeType.startsWith("image/")
  const isPdf = mimeType === "application/pdf"
  const canPreview = isImage || isPdf

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-3 bg-black/60">
        <div className="flex items-center gap-3 min-w-0">
          <Icon name={isImage ? "image" : isPdf ? "picture_as_pdf" : "description"} size="md" className="text-white/70 shrink-0" />
          <span className="text-sm font-bold text-white truncate">{fileName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={fileUrl}
            download={fileName}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors min-h-[44px]"
          >
            <Icon name="download" size="sm" />
            הורדה
          </a>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors min-h-[44px]"
          >
            <Icon name="close" size="md" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4 overflow-auto">
        {isImage && (
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        )}
        {isPdf && (
          <iframe
            src={fileUrl}
            title={fileName}
            className="w-full h-full max-w-4xl rounded-xl bg-white"
          />
        )}
        {!canPreview && (
          <div className="flex flex-col items-center gap-4 text-white">
            <Icon name="description" size="xl" className="opacity-50" />
            <p className="text-lg font-bold">לא ניתן להציג קובץ מסוג זה</p>
            <a
              href={fileUrl}
              download={fileName}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors min-h-[44px]"
            >
              <Icon name="download" size="sm" />
              הורד את הקובץ
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
