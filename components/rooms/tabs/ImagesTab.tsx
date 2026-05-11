"use client"

import { useRef, useState } from "react"
import type { RoomFormStore, RoomImage } from "@/lib/stores/room-form-store"
import { Icon } from "@/components/shared/Icon"

interface ImagesTabProps {
  store: RoomFormStore
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ImagesTab({ store }: ImagesTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  const maxImages = 20
  const canAddMore = store.images.length < maxImages

  function handleAddUrl() {
    if (!urlInput.trim() || !canAddMore) return

    const newImage: RoomImage = {
      id: crypto.randomUUID(),
      file_url: urlInput.trim(),
      file_name: urlInput.split("/").pop() ?? "image",
      file_size: 0,
      width: 0,
      height: 0,
      sort_order: store.images.length,
      is_primary: store.images.length === 0,
    }

    store.addImage(newImage)
    if (store.images.length === 0) {
      store.setPrimaryImage(newImage.id)
    }
    setUrlInput("")
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    // Placeholder - actual file upload not implemented yet
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-[20px] p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border/40 hover:border-primary/40 hover:bg-accent/50"
        } ${!canAddMore ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={() => {
            // Placeholder - actual file upload not implemented yet
          }}
        />
        <div className="flex flex-col items-center gap-2">
          <Icon name="add" size="xl" className="text-muted-foreground" />
          <p className="text-sm font-medium">גרור תמונות לכאן או לחץ לבחירה</p>
          <p className="text-xs text-muted-foreground">
            {store.images.length}/{maxImages} תמונות
          </p>
        </div>
      </div>

      {/* URL input placeholder */}
      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddUrl()
          }}
          placeholder="הוסף תמונה לפי כתובת URL"
          disabled={!canAddMore}
          className="flex-1 rounded-xl border-0 bg-accent min-h-[48px] px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleAddUrl}
          disabled={!urlInput.trim() || !canAddMore}
          className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium min-h-[44px] min-w-[44px] disabled:opacity-50 transition-colors hover:bg-primary/90"
        >
          הוסף
        </button>
      </div>

      {/* Image grid */}
      {store.images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {store.images.map((img) => (
            <div
              key={img.id}
              className={`rounded-[20px] border shadow-sm overflow-hidden ${
                img.is_primary ? "border-primary/40" : "border-border/20"
              }`}
            >
              {/* Preview */}
              <div className="relative aspect-video bg-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.file_url}
                  alt={img.file_name}
                  className="w-full h-full object-cover"
                />
                {img.is_primary && (
                  <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                    ראשית
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-4 space-y-2">
                <p className="text-sm font-medium truncate">{img.file_name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {img.file_size > 0 && <span>{formatFileSize(img.file_size)}</span>}
                  {img.width > 0 && img.height > 0 && (
                    <span>
                      {img.width}x{img.height}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {!img.is_primary && (
                    <button
                      type="button"
                      onClick={() => store.setPrimaryImage(img.id)}
                      className="rounded-xl border border-border/40 px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors min-h-[44px]"
                    >
                      הגדר כראשית
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => store.removeImage(img.id)}
                    className="rounded-xl border border-destructive/30 text-destructive px-3 py-1.5 text-xs font-medium hover:bg-destructive/5 transition-colors min-h-[44px] mr-auto"
                  >
                    מחק
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!canAddMore && (
        <p className="text-xs text-amber-500 text-center">
          הגעת למקסימום {maxImages} תמונות
        </p>
      )}
    </div>
  )
}
