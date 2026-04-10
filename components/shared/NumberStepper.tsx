"use client"

interface NumberStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label?: string
}

export function NumberStepper({ value, onChange, min = 0, max = 99, label }: NumberStepperProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-bold text-muted-foreground text-center">{label}</label>
      )}
      <div className="flex items-center justify-between bg-accent rounded-full px-4 py-2">
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-11 h-11 flex items-center justify-center text-xl font-medium hover:bg-card rounded-full transition-colors disabled:opacity-30 min-w-[44px] min-h-[44px]"
        >
          +
        </button>
        <span className="text-lg font-bold tabular-nums min-w-[2ch] text-center">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-11 h-11 flex items-center justify-center text-xl font-medium hover:bg-card rounded-full transition-colors disabled:opacity-30 min-w-[44px] min-h-[44px]"
        >
          -
        </button>
      </div>
    </div>
  )
}
