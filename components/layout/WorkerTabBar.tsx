"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Icon } from "@/components/shared/Icon"
import { SidePanel } from "@/components/shared/SidePanel"
import { getMyProfile } from "@/lib/actions/auth"

/**
 * Top tab bar for the field-worker mobile shell. Renders:
 *   row 1 — user chip (avatar + name + role) and a hamburger that opens
 *           a side panel with profile details + sign-out.
 *   row 2 — three navigation tabs (Cleaning / Maintenance / Attendance).
 *
 * Per-route access control still lives in the routes themselves; the tab
 * bar intentionally does NOT permission-filter.
 */

const TABS = [
  { href: "/housekeeping/my-tasks", icon: "cleaning_services", label: "משימות" },
  { href: "/maintenance/my-tasks", icon: "construction", label: "תחזוקה" },
  { href: "/attendance/my", icon: "schedule", label: "נוכחות" },
] as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

/* Items shown inside the hamburger menu — secondary destinations
 * that don't earn a spot in the 3-tab strip (which stays compact). */
const MENU_ITEMS = [
  { href: "/attendance/my-requests", icon: "event_busy", label: "הבקשות שלי" },
] as const

export function WorkerTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [profile, setProfile] = useState<{
    full_name: string
    email: string
  } | null>(null)

  useEffect(() => {
    getMyProfile().then((p) => {
      if (p) setProfile(p)
    })
  }, [])

  const fullName = profile?.full_name ?? ""
  const email = profile?.email ?? ""

  async function handleSignOut() {
    setSigningOut(true)
    const { createClientSupabase } = await import("@/lib/supabase/client")
    const supabase = createClientSupabase()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <>
      <nav
        aria-label="ניווט עובד"
        className="bg-card border-b border-border/15"
      >
        {/* Row 1: user chip + hamburger */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-xs shrink-0">
              {fullName ? initials(fullName) : "?"}
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[13px] font-medium text-foreground truncate">
                {fullName || "טוען..."}
              </span>
              <span className="text-[10px] text-muted-foreground">עובד ניקיון</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="w-9 h-9 rounded-md border border-border/15 flex items-center justify-center hover:bg-accent transition-colors shrink-0"
            aria-label="תפריט"
          >
            <Icon name="menu" size="sm" />
          </button>
        </div>

        {/* Row 2: tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1.5">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-xl min-h-[52px] flex flex-col items-center justify-center gap-1 border-2 transition-colors ${
                  active
                    ? "bg-gradient-to-br from-[#003aa0]/10 to-[#3F51B5]/10 border-primary text-primary"
                    : "bg-accent/30 border-transparent text-muted-foreground hover:bg-accent/50"
                }`}
              >
                <Icon name={tab.icon} size="md" />
                <span className="text-[11px] font-bold">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <SidePanel
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="תפריט"
      >
        <div className="space-y-4 p-1">
          <div className="bg-card border border-border/15 rounded-[20px] p-5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold shrink-0">
              {fullName ? initials(fullName) : "?"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold truncate">{fullName || "—"}</span>
              <span className="text-xs text-muted-foreground truncate">
                {email || "—"}
              </span>
            </div>
          </div>

          {/* Secondary destinations */}
          <div className="bg-card border border-border/15 rounded-[20px] p-2 space-y-1">
            {MENU_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    router.push(item.href)
                  }}
                  className={`w-full min-h-[52px] rounded-xl flex items-center gap-3 px-4 text-right font-bold transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <Icon name={item.icon} size="md" />
                  <span className="flex-1">{item.label}</span>
                  <Icon name="chevron_left" size="sm" className="opacity-60" />
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full min-h-[52px] rounded-xl bg-destructive/10 text-destructive font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Icon name="logout" size="sm" />
            {signingOut ? "מתנתק..." : "התנתקות"}
          </button>
        </div>
      </SidePanel>
    </>
  )
}
