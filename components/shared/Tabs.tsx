"use client"

import { Icon } from "@/components/shared/Icon"

export interface TabItem {
  value: string
  label: string
  icon?: string
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  variant?: "subtle" | "segmented"
  className?: string
  ariaLabel?: string
}

export function Tabs({
  items,
  value,
  onChange,
  variant = "subtle",
  className = "",
  ariaLabel,
}: TabsProps) {
  if (variant === "segmented") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        dir="rtl"
        className={`inline-flex bg-[#f1f5f9] p-0.5 rounded-[10px] ${className}`}
      >
        {items.map((item) => {
          const active = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.value)}
              className={`inline-flex items-center gap-2 px-5 py-1.5 rounded-lg font-bold text-sm min-h-[44px] transition-all duration-200 ${
                active
                  ? "bg-white text-[#1e40af] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]"
                  : "text-[#474747] hover:text-[#1e40af]"
              }`}
            >
              {item.icon && <Icon name={item.icon} size="sm" />}
              {item.label}
            </button>
          )
        })}
      </div>
    )
  }

  // Subtle Card (default)
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      dir="rtl"
      className={`inline-flex bg-[#f4f2fc] p-1 rounded-xl ${className}`}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm min-h-[44px] transition-all duration-200 ${
              active
                ? "bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                : "text-[#474747] hover:text-[#1e40af]"
            }`}
          >
            {item.icon && <Icon name={item.icon} size="sm" />}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
