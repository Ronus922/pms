"use client"

import { useState, useRef } from "react"
import { Icon } from "@/components/shared/Icon"
import type { MaintenanceTaskMedia, MaintenanceMediaPhase } from "@/lib/types/maintenance"

interface MaintenanceMediaSectionProps {
  media: MaintenanceTaskMedia[]
  onUpload: (files: File[], phase: MaintenanceMediaPhase) => Promise<void>
  onRemove?: (mediaId: string) => Promise<void>
  canEdit: boolean
  uploading?: boolean
}

const PHASE_CONFIG: Record<MaintenanceMediaPhase, { label: string; icon: string; description: string }> = {
  before: { label: "לפני טיפול", icon: "photo_camera", description: "תמונות של התקלה לפני הטיפול" },
  after: { label: "אחרי טיפול", icon: "check_circle", description: "תמונות של התוצאה אחרי הטיפול" },
  general: { label: "כללי", icon: "attach_file", description: "קבצים ותמונות נוספים" },
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]

export function MaintenanceMediaSection({
  media,
  onUpload,
  onRemove,
  canEdit,
  uploading,
}: MaintenanceMediaSectionProps) {
  const phases: MaintenanceMediaPhase[] = ["before", "after", "general"]

  return (
    <div className="space-y-6" dir="rtl">
      {phases.map((phase) => {
        const phaseMedia = media.filter((m) => m.phase === phase)
        const config = PHASE_CONFIG[phase]

        return (
          <div key={phase}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name={config.icon} size="md" className="text-muted-foreground" />
              <div>
                <h4 className="text-sm font-bold text-foreground">{config.label}</h4>
                <p className="text-[11px] text-muted-foreground">{config.description}</p>
              </div>
              <span className="text-[11px] text-muted-foreground ms-auto tabular-nums">
                {phaseMedia.length} קבצים
              </span>
            </div>

            {/* Thumbnails grid */}
            {phaseMedia.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {phaseMedia.map((m) => (
                  <MediaThumb key={m.id} media={m} canEdit={canEdit} onRemove={onRemove} />
                ))}
              </div>
            )}

            {/* Upload area */}
            {canEdit && (
              <UploadZone
                phase={phase}
                onUpload={onUpload}
                uploading={uploading}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function MediaThumb({
  media,
  canEdit,
  onRemove,
}: {
  media: MaintenanceTaskMedia
  canEdit: boolean
  onRemove?: (id: string) => Promise<void>
}) {
  const [removing, setRemoving] = useState(false)
  const isImage = media.media_type === "image"

  const handleRemove = async () => {
    if (!onRemove) return
    setRemoving(true)
    await onRemove(media.id)
    setRemoving(false)
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-border/30 aspect-square bg-accent">
      {isImage ? (
        <img
          src={media.file_url}
          alt={media.file_name ?? ""}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
          <Icon name="description" size="lg" className="text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground text-center truncate w-full">
            {media.file_name}
          </span>
        </div>
      )}

      {canEdit && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          className="absolute top-1 left-1 w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {removing ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="close" size="sm" />
          )}
        </button>
      )}
    </div>
  )
}

function UploadZone({
  phase,
  onUpload,
  uploading,
}: {
  phase: MaintenanceMediaPhase
  onUpload: (files: File[], phase: MaintenanceMediaPhase) => Promise<void>
  uploading?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setError(null)

    const validFiles: File[] = []
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`הקובץ ${file.name} גדול מ-10MB`)
        continue
      }
      if (!ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
        setError(`סוג קובץ לא נתמך: ${file.name}`)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length > 0) {
      await onUpload(validFiles, phase)
    }
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full border-2 border-dashed border-border/40 rounded-xl p-4 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all min-h-[44px]"
      >
        {uploading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Icon name="cloud_upload" size="md" />
        )}
        <span className="text-xs font-medium">
          {uploading ? "מעלה..." : "לחץ להעלאה או צלם תמונה"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        capture="environment"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      {error && (
        <p className="text-[11px] text-red-500 mt-1">{error}</p>
      )}
    </div>
  )
}
