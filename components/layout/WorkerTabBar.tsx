"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/shared/Icon"

/**
 * Top-tab bar for field-worker mobile views. Mounted by DashboardShell
 * inside the chromeless cleaner-mobile branch, above the page body.
 *
 * Sticky at top-0 in the parent scroll context — sits *below* whatever
 * sticky header the active page renders (each page owns its own header
 * with a higher z-index), and remains visible as the body scrolls.
 *
 * Tabs are intentionally NOT permission-filtered: every worker who lands
 * in the field shell sees all three. Per-route access control lives in
 * the routes themselves.
 */

const TABS = [
  { href: "/housekeeping/my-tasks", icon: "cleaning_services", label: "משימות" },
  { href: "/maintenance/my-tasks", icon: "construction", label: "תחזוקה" },
  { href: "/attendance/my", icon: "schedule", label: "נוכחות" },
] as const

export function WorkerTabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="ניווט עובד"
      className="sticky top-0 z-30 bg-card border-b border-border/15"
    >
      <div className="grid grid-cols-3 gap-2 p-2">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-xl min-h-[72px] flex flex-col items-center justify-center gap-1 border-2 transition-colors ${
                active
                  ? "bg-gradient-to-br from-[#003aa0]/10 to-[#3F51B5]/10 border-primary text-primary"
                  : "bg-accent/30 border-transparent text-muted-foreground hover:bg-accent/50"
              }`}
            >
              <Icon name={tab.icon} size="lg" />
              <span className="text-xs font-bold">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
