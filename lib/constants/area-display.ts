/* ── Area Display Constants ────────────────────────────────── */

/** Visual style for area cards in the rooms & areas grid */
export const AREA_CARD_STYLE = {
  border: "border-violet-400",
  badgeBg: "bg-violet-500/10",
  badgeText: "text-violet-600",
  badgeLabel: "אזור",
  icon: "meeting_room",
} as const

/** Visual style for room cards (used when showing badge in mixed view) */
export const ROOM_CARD_BADGE = {
  badgeBg: "bg-blue-500/10",
  badgeText: "text-blue-600",
  badgeLabel: "חדר",
  icon: "bed",
} as const

/** Target type filter options for the rooms & areas page */
export const TARGET_TYPE_FILTERS = [
  { key: "all" as const, label: "הכל", icon: "apps" },
  { key: "rooms" as const, label: "חדרים", icon: "bed" },
  { key: "areas" as const, label: "אזורים", icon: "meeting_room" },
] as const

export type TargetTypeFilter = "all" | "rooms" | "areas"
