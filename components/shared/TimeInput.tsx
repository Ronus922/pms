"use client"

import { useRef } from "react"
import { inputClass } from "@/components/shared/FormField"
import { Icon } from "@/components/shared/Icon"

interface TimeInputProps {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  error?: boolean
  className?: string
}

export function TimeInput({ value, onChange, disabled, error, className = "" }: TimeInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div
      className="relative cursor-pointer"
      onClick={() => {
        if (!disabled && ref.current) {
          ref.current.showPicker?.()
          ref.current.focus()
        }
      }}
    >
      <input
        ref={ref}
        type="time"
        className={`${inputClass} cursor-pointer picker-no-icon ${error ? "border-destructive/60 ring-1 ring-destructive/20" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <Icon
        name="schedule"
        size="sm"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
    </div>
  )
}
