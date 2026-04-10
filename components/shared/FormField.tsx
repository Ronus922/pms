interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, required, error, children, className = "" }: FormFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-bold text-muted-foreground mr-1">
        {label}
        {required && <span className="text-destructive mr-0.5"> *</span>}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-destructive mr-1">{error}</p>
      )}
    </div>
  )
}

export const inputClass = "w-full bg-accent border border-border/40 rounded-xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none min-h-[48px]"

export const selectClass = "w-full bg-accent border border-border/40 rounded-xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none appearance-none cursor-pointer min-h-[48px]"

export const textareaClass = "w-full bg-accent border border-border/40 rounded-xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none resize-none min-h-[48px]"
