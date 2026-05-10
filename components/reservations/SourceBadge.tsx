"use client"

import { Icon } from "@/components/shared/Icon"

/* ── Booking Sources ────────────────────────────────────────── */

const SOURCE_MAP: Record<string, { label: string; color: string; icon: string }> = {
  direct:     { label: "ישיר",         color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",       icon: "phone" },
  phone:      { label: "טלפון",        color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",       icon: "call" },
  website:    { label: "אתר",          color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", icon: "public" },
  booking:    { label: "Booking.com",  color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",       icon: "public" },
  airbnb:     { label: "Airbnb",       color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",       icon: "favorite" },
  expedia:    { label: "Expedia",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",   icon: "public" },
  agent:      { label: "סוכן",         color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: "person_search" },
  corporate:  { label: "חברה",         color: "bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300",    icon: "hub" },
  walk_in:    { label: "Walk-in",      color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: "login" },
  whatsapp:   { label: "WhatsApp",     color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",   icon: "call" },
  other:      { label: "אחר",          color: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",       icon: "help" },
}

interface SourceBadgeProps {
  value: string
  size?: "sm" | "md"
}

export function SourceBadge({ value, size = "sm" }: SourceBadgeProps) {
  const item = SOURCE_MAP[value]
  if (!item) return <span className="text-xs text-muted-foreground">{value}</span>

  const sizeClass = size === "md"
    ? "px-3 py-1.5 text-xs gap-1.5"
    : "px-2.5 py-1 text-[11px] gap-1"

  return (
    <span className={`inline-flex items-center font-bold rounded-full ${sizeClass} ${item.color}`}>
      <Icon name={item.icon} size="sm" />
      {item.label}
    </span>
  )
}

export const BOOKING_SOURCES = Object.entries(SOURCE_MAP).map(([value, { label }]) => ({ value, label }))

export function getSourceColorClass(value: string): string {
  return SOURCE_MAP[value]?.color ?? ""
}

export { SOURCE_MAP }
