"use client"

import { Icon } from "@/components/shared/Icon"

/* ── Connection status ──────────────────────────────────────── */

export function ConnectionStatusPill({
  status,
}: {
  status: "pending" | "connected" | "disabled" | "error" | null
}) {
  const map = {
    connected: {
      label: "מחובר",
      icon: "check_circle",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    pending: {
      label: "ממתין",
      icon: "hourglass_empty",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    error: {
      label: "שגיאה",
      icon: "error",
      cls: "bg-destructive/10 text-destructive border-destructive/30",
    },
    disabled: {
      label: "מנותק",
      icon: "link_off",
      cls: "bg-muted text-muted-foreground border-border/30",
    },
  } as const
  const key = status ?? "disabled"
  const m = map[key as keyof typeof map] ?? map.disabled
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${m.cls}`}
    >
      <Icon name={m.icon} size="sm" />
      {m.label}
    </span>
  )
}

/* ── Job status ─────────────────────────────────────────────── */

export function JobStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    pending: {
      label: "ממתין",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
      icon: "schedule",
    },
    running: {
      label: "רץ",
      cls: "bg-indigo-50 text-indigo-700 border-indigo-200",
      icon: "play_arrow",
    },
    retry: {
      label: "נסיון חוזר",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      icon: "replay",
    },
    done: {
      label: "הצלחה",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: "check",
    },
    failed: {
      label: "נכשל",
      cls: "bg-destructive/10 text-destructive border-destructive/30",
      icon: "close",
    },
    cancelled: {
      label: "בוטל",
      cls: "bg-muted text-muted-foreground border-border/30",
      icon: "block",
    },
  }
  const m = map[status] ?? map.pending
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${m.cls}`}
    >
      <Icon name={m.icon} size="sm" />
      {m.label}
    </span>
  )
}

/* ── Webhook event status ───────────────────────────────────── */

export function EventStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    received: { label: "התקבל", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    processed: {
      label: "עובד",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    failed: {
      label: "נכשל",
      cls: "bg-destructive/10 text-destructive border-destructive/30",
    },
    ignored: {
      label: "התעלם",
      cls: "bg-muted text-muted-foreground border-border/30",
    },
  }
  const m = map[status] ?? map.received
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.cls}`}
    >
      {m.label}
    </span>
  )
}

/* ── Booking revision status ────────────────────────────────── */

export function RevisionStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: "חדש", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    modified: {
      label: "שונה",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    cancelled: {
      label: "בוטל",
      cls: "bg-destructive/10 text-destructive border-destructive/30",
    },
  }
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border/30" }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.cls}`}
    >
      {m.label}
    </span>
  )
}

export function ProcessedStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "ממתין",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
    },
    imported: {
      label: "יובא",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    unmapped: {
      label: "לא ממופה",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    skipped: {
      label: "דולג",
      cls: "bg-muted text-muted-foreground border-border/30",
    },
    failed: {
      label: "נכשל",
      cls: "bg-destructive/10 text-destructive border-destructive/30",
    },
  }
  const m = map[status] ?? map.pending
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.cls}`}
    >
      {m.label}
    </span>
  )
}
