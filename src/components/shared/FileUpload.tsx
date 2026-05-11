'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FileRecord {
  id: string
  name: string
  size: number
  type: string
  url?: string
  progress?: number
}

interface FileUploadProps {
  value: FileRecord[]
  onChange: (files: FileRecord[]) => void
  maxFiles?: number
  maxSizeMB?: number
  acceptedTypes?: string[]
  disabled?: boolean
  className?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function generateId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function isImageType(type: string): boolean {
  return type.startsWith('image/')
}

export function FileUpload({
  value,
  onChange,
  maxFiles = 5,
  maxSizeMB = 10,
  acceptedTypes,
  disabled,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const canAddMore = value.length < maxFiles

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) return

      const maxBytes = maxSizeMB * 1024 * 1024
      const remaining = maxFiles - value.length
      const files = Array.from(fileList).slice(0, remaining)

      const newRecords: FileRecord[] = files
        .filter((f) => {
          if (f.size > maxBytes) return false
          if (acceptedTypes && !acceptedTypes.some((t) => f.type.match(t))) return false
          return true
        })
        .map((f) => ({
          id: generateId(),
          name: f.name,
          size: f.size,
          type: f.type,
          url: isImageType(f.type) ? URL.createObjectURL(f) : undefined,
        }))

      onChange([...value, ...newRecords])
    },
    [value, onChange, maxFiles, maxSizeMB, acceptedTypes, disabled],
  )

  const removeFile = (id: string) => {
    const file = value.find((f) => f.id === id)
    if (file?.url) URL.revokeObjectURL(file.url)
    onChange(value.filter((f) => f.id !== id))
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles],
  )

  return (
    <div className={cn('space-y-3', className)} dir="rtl">
      {/* Drop zone */}
      {canAddMore && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            'relative border-2 border-dashed rounded-xl p-8',
            'flex flex-col items-center justify-center gap-3 cursor-pointer',
            'transition-colors text-center',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border/50 hover:border-primary/40 hover:bg-accent/50',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            multiple={maxFiles > 1}
            accept={acceptedTypes?.join(',')}
            onChange={(e) => {
              processFiles(e.target.files)
              e.target.value = ''
            }}
            disabled={disabled}
          />

          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Upload size={24} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">
              גרור קבצים לכאן או <span className="text-primary">לחץ לבחירה</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              עד {maxFiles} קבצים, מקסימום {maxSizeMB}MB לקובץ
            </p>
          </div>
        </div>
      )}

      {/* File list */}
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 p-3 bg-accent/50 rounded-xl border border-border/30"
            >
              {/* Thumbnail or icon */}
              {file.url && isImageType(file.type) ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-muted-foreground" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                </p>
                {file.progress !== undefined && file.progress < 100 && (
                  <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              {file.progress !== undefined && file.progress < 100 ? (
                <Loader2 size={16} className="animate-spin text-primary shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  disabled={disabled}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                  aria-label={`הסר ${file.name}`}
                >
                  <X size={14} className="text-red-500" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
