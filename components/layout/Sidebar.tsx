"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/shared/Icon"
import { usePermissions } from "@/lib/hooks/use-tenant"
import { getRoleLabel } from "@/lib/permissions/constants"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"

type NavItem = {
  href: string
  icon: string
  label: string
  module: string
  /** When true, require `edit` (not just `view`) on the module. */
  requiresEdit?: boolean
  /** Optional count pill. Rendered only when a real count is supplied. */
  badge?: number
}

type NavSection = {
  title: string
  items: NavItem[]
}

/** Grouped navigation — section titles mirror `יומן חדרים נקי` design-ref. */
const NAV_SECTIONS: NavSection[] = [
  {
    title: "ניהול",
    items: [
      { href: "/dashboard", icon: "dashboard", label: "דשבורד", module: "dashboard" },
      { href: "/calendar", icon: "calendar_month", label: "תפוסה", module: "calendar" },
      { href: "/reservations", icon: "receipt_long", label: "הזמנות", module: "reservations" },
      { href: "/guests", icon: "group", label: "אורחים", module: "guests" },
      { href: "/rooms", icon: "bed", label: "חדרים", module: "rooms" },
      { href: "/rooms/blocks", icon: "block", label: "חסימות חדרים", module: "rooms" },
      { href: "/bulk-update", icon: "sync_alt", label: "עדכון קבוצתי", module: "rooms" },
    ],
  },
  {
    title: "תפעול",
    items: [
      { href: "/housekeeping", icon: "cleaning_services", label: "ניקיון", module: "housekeeping" },
      { href: "/maintenance", icon: "build", label: "תחזוקה", module: "maintenance" },
      { href: "/staff", icon: "badge", label: "עובדים", module: "staff" },
      { href: "/attendance", icon: "schedule", label: "נוכחות", module: "attendance" },
      { href: "/attendance/my-requests", icon: "event_busy", label: "הבקשות שלי", module: "absence_requests" },
      { href: "/attendance/requests", icon: "fact_check", label: "אישור בקשות", module: "absence_requests", requiresEdit: true },
    ],
  },
  {
    title: "ניהול עסקי",
    items: [
      { href: "/documents", icon: "description", label: "מסמכים", module: "documents" },
      { href: "/finance", icon: "payments", label: "כספים", module: "finance" },
      { href: "/suppliers", icon: "local_shipping", label: "ספקים", module: "suppliers" },
      { href: "/reports", icon: "bar_chart", label: "דוחות", module: "reports" },
    ],
  },
  {
    title: "מערכת",
    items: [
      { href: "/automations", icon: "bolt", label: "אוטומציות", module: "automations" },
      { href: "/channels", icon: "hub", label: "ערוצים", module: "channels" },
      { href: "/settings", icon: "settings", label: "הגדרות", module: "settings" },
      { href: "/permissions", icon: "verified_user", label: "הרשאות", module: "permissions" },
    ],
  },
]

interface SidebarProps {
  tenantName?: string
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ tenantName = "GuestHub", collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { can, role } = usePermissions()
  const openNewReservation = useReservationFormStore((s) => s.open)

  const canSee = (item: NavItem) =>
    item.requiresEdit ? can(item.module, "edit") : can(item.module, "view")

  // Sections with at least one permitted item — empty groups drop out entirely.
  const visibleSections = NAV_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items.filter(canSee),
  })).filter((section) => section.items.length > 0)

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    const { createClientSupabase } = await import("@/lib/supabase/client")
    const supabase = createClientSupabase()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const roleLabel = getRoleLabel(role)
  const avatarInitial = (roleLabel || tenantName || "מ").trim().charAt(0)

  function renderItem(item: NavItem) {
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`relative flex items-center gap-3 rounded-xl px-4 py-2.5 min-h-[44px] transition-colors duration-200 ${
          active
            ? "bg-primary/10 text-primary font-semibold"
            : "text-muted-foreground hover:bg-accent font-medium"
        } ${collapsed ? "justify-center px-3" : ""}`}
        title={collapsed ? item.label : undefined}
      >
        {active && (
          <span
            aria-hidden
            className="absolute right-0 top-[20%] h-[60%] w-1 rounded-l-sm bg-primary"
          />
        )}
        {!collapsed && <span className="flex-1 text-sm">{item.label}</span>}
        {!collapsed && item.badge != null && item.badge > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tabular-nums">
            {item.badge}
          </span>
        )}
        <Icon name={item.icon} filled={active} size="md" />
      </Link>
    )
  }

  return (
    <nav
      className={`h-screen fixed right-0 top-0 border-l border-border bg-card flex flex-col z-50 transition-all duration-300 ${collapsed ? "w-20" : "w-72"}`}
      dir="rtl"
    >
      {/* Logo / Branding */}
      <div className="px-6 pt-6 pb-5 flex items-center gap-3">
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold text-foreground tracking-tight truncate leading-tight">
              {tenantName}
            </h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Property Management</p>
          </div>
        )}
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm flex-shrink-0">
          <Icon name="dashboard" filled />
        </div>
      </div>

      {/* Primary CTA — New Booking */}
      {!collapsed ? (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => openNewReservation()}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm py-3 rounded-xl transition-colors min-h-[44px] shadow-sm"
          >
            הזמנה חדשה
            <Icon name="add_circle" size="sm" />
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 flex justify-center">
          <button
            type="button"
            onClick={() => openNewReservation()}
            aria-label="הזמנה חדשה"
            className="w-12 h-12 inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-colors shadow-sm"
          >
            <Icon name="add" />
          </button>
        </div>
      )}

      {/* Grouped navigation */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-4">
        {visibleSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed ? (
              <p className="px-4 pt-1 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </p>
            ) : (
              <div className="mx-3 my-2 border-t border-border" aria-hidden />
            )}
            {section.items.map(renderItem)}
          </div>
        ))}
      </div>

      {/* User card */}
      <div className="px-3 pt-2 border-t border-border">
        <div
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent transition-colors ${
            collapsed ? "justify-center px-2" : ""
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
            {avatarInitial}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate leading-tight">{roleLabel}</p>
                <p className="text-[11px] text-muted-foreground truncate">{tenantName}</p>
              </div>
              <Icon name="expand_more" size="sm" className="text-muted-foreground flex-shrink-0" />
            </>
          )}
        </div>
      </div>

      {/* Logout — bottom, separated, red */}
      <div className="px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={handleLogout}
          className={`flex items-center gap-3 rounded-xl px-4 py-2.5 min-h-[44px] w-full text-destructive hover:bg-destructive/10 font-semibold transition-colors ${
            collapsed ? "justify-center px-3" : ""
          }`}
          title={collapsed ? "התנתקות" : undefined}
        >
          {!collapsed && <span className="flex-1 text-sm text-right">התנתקות</span>}
          <Icon name="logout" size="sm" />
        </button>
      </div>

      {/* Floating collapse toggle — circular, on left edge */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "הרחב תפריט" : "כווץ תפריט"}
        title={collapsed ? "הרחב תפריט" : "כווץ תפריט"}
        className="absolute left-[-14px] top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-card border border-border shadow-md hover:bg-accent hover:border-primary hover:text-primary flex items-center justify-center text-muted-foreground transition-colors z-50"
      >
        <Icon name={collapsed ? "chevron_left" : "chevron_right"} size="sm" />
      </button>
    </nav>
  )
}
