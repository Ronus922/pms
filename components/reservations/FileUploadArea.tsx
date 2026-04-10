"use client"

import { useRef } from "react"
import { Icon } from "@/components/shared/Icon"
import { useReservationFormStore, type AttachmentFile } from "@/lib/stores/reservation-form-store"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
const MAX_FILES = 10
const MAX_SIZE = 15 * 1024 * 1024

export function FileUploadArea() {
  const { attachments, addAttachment, removeAttachment } = useReservationFormStore()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      if (attachments.length >= MAX_FILES) break
      const file = files[i]
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      if (file.size > MAX_SIZE) continue

      const attachment: AttachmentFile = {
        id: `file-${Date.now()}-${i}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
      }
      addAttachment(attachment)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files)
    e.target.value = ""
  }

  const isImage = (type: string) => type.startsWith("image/")

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-border/40 rounded-[20px] p-8 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon name="upload" size="lg" className="text-primary" />
        </div>
        <p className="text-sm font-bold text-foreground">גרור קבצים לכאן</p>
        <p className="text-xs text-muted-foreground">תמונות, PDF, מסמכים | עד {MAX_FILES} קבצים | 15MB לקובץ</p>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {/* Files grid */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="relative group rounded-xl border border-border/20 overflow-hidden bg-accent"
            >
              {isImage(file.type) ? (
                <div className="aspect-square">
                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-square flex flex-col items-center justify-center gap-2 p-4">
                  <Icon name="sticky_note_2" size="xl" className="text-muted-foreground/40" />
                  <p className="text-[12px] font-bold text-muted-foreground truncate w-full text-center">{file.name}</p>
                </div>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeAttachment(file.id)}
                className="absolute top-1.5 left-1.5 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Icon name="close" size="sm" className="text-white" />
              </button>

              {/* Size */}
              <div className="absolute bottom-0 inset-x-0 bg-black/40 px-2 py-1 text-[9px] text-white font-bold">
                {(file.size / 1024).toFixed(0)} KB
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
