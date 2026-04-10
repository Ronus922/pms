/* ── Room Display State — single source of truth ───────── */

export type RoomDisplayState =
  | "occupied"
  | "available"
  | "dirty"
  | "in_progress"
  | "blocked"
  | "maintenance"

export interface RoomStateVisual {
  label: string
  color: string      // tailwind utility
  border: string     // tailwind utility
  hex: string        // calendar / inline styles
  icon: string
}

export const ROOM_STATE_DISPLAY: Record<RoomDisplayState, RoomStateVisual> = {
  occupied: {
    label: "תפוס",
    color: "bg-primary",
    border: "border-primary",
    hex: "#003aa0",
    icon: "person",
  },
  available: {
    label: "פנוי",
    color: "bg-emerald-500",
    border: "border-emerald-500",
    hex: "#22c55e",
    icon: "check_circle",
  },
  dirty: {
    label: "מלוכלך",
    color: "bg-amber-500",
    border: "border-amber-500",
    hex: "#f59e0b",
    icon: "cleaning_services",
  },
  in_progress: {
    label: "בניקיון",
    color: "bg-amber-400",
    border: "border-amber-400",
    hex: "#fbbf24",
    icon: "local_laundry_service",
  },
  blocked: {
    label: "חסום",
    color: "bg-red-500",
    border: "border-red-500",
    hex: "#ef4444",
    icon: "block",
  },
  maintenance: {
    label: "תחזוקה",
    color: "bg-red-600",
    border: "border-red-600",
    hex: "#dc2626",
    icon: "build",
  },
}

/** Get hex color for calendar grid */
export function getRoomStateHex(state: string): string {
  return ROOM_STATE_DISPLAY[state as RoomDisplayState]?.hex ?? "#22c55e"
}
