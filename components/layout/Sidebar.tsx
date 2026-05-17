"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/shared/Icon"
import { usePermissions } from "@/lib/hooks/use-tenant"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"

type NavItem = {
  href: string
  icon: string
  label: string
  module: string
  /** When true, require `edit` (not just `view`) on the module. */
  requiresEdit?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: "dashboard", label: "דשבורד", module: "dashboard" },
  { href: "/calendar", icon: "calendar_month", label: "תפוסה", module: "calendar" },
  { href: "/reservations", icon: "receipt_long", label: "הזמנות", module: "reservations" },
  { href: "/guests", icon: "group", label: "אורחים", module: "guests" },
  { href: "/rooms", icon: "bed", label: "חדרים", module: "rooms" },
  { href: "/rooms/blocks", icon: "block", label: "חסימות חדרים", module: "rooms" },
  { href: "/bulk-update", icon: "sync_alt", label: "עדכון קבוצתי", module: "rooms" },
  { href: "/housekeeping", icon: "cleaning_services", label: "ניקיון", module: "housekeeping" },
  { href: "/maintenance", icon: "build", label: "תחזוקה", module: "maintenance" },
  { href: "/staff", icon: "badge", label: "עובדים", module: "staff" },
  { href: "/attendance", icon: "schedule", label: "נוכחות", module: "attendance" },
  { href: "/attendance/my-requests", icon: "event_busy", label: "הבקשות שלי", module: "absence_requests" },
  { href: "/attendance/requests", icon: "fact_check", label: "אישור בקשות", module: "absence_requests", requiresEdit: true },
  { href: "/documents", icon: "description", label: "מסמכים", module: "documents" },
  { href: "/finance", icon: "payments", label: "כספים", module: "finance" },
  { href: "/suppliers", icon: "local_shipping", label: "ספקים", module: "suppliers" },
  { href: "/reports", icon: "bar_chart", label: "דוחות", module: "reports" },
]

const BOTTOM_ITEMS = [
  { href: "/automations", icon: "bolt", label: "אוטומציות", module: "automations" },
  { href: "/channels", icon: "hub", label: "ערוצים", module: "channels" },
  { href: "/settings", icon: "settings", label: "הגדרות", module: "settings" },
  { href: "/permissions", icon: "verified_user", label: "הרשאות", module: "permissions" },
]

interface SidebarProps {
  tenantName?: string
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ tenantName = "GuestHub", collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { can } = usePermissions()
  const openNewReservation = useReservationFormStore((s) => s.open)

  const visibleNav = NAV_ITEMS.filter((item) =>
    item.requiresEdit
      ? can(item.module, "edit")
      : can(item.module, "view"),
  )
  const visibleBottom = BOTTOM_ITEMS.filter((item) => can(item.module, "view"))

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

  return (
    <nav
      className={`h-screen fixed right-0 top-0 border-l border-[#dad9e3] bg-white flex flex-col z-50 transition-all duration-300 ${collapsed ? "w-20" : "w-72"}`}
      dir="rtl"
    >
      {/* Logo / Branding */}
      <div className="px-6 pt-6 pb-5 flex items-center gap-3">
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold text-[#1c1b1f] tracking-tight truncate leading-tight">
              {tenantName}
            </h1>
            <p className="text-xs text-[#6b6280] font-medium mt-0.5">Property Management</p>
          </div>
        )}
        <div className="w-10 h-10 rounded-xl bg-[#1e40af] flex items-center justify-center text-white shadow-sm flex-shrink-0">
          <Icon name="dashboard" filled />
        </div>
      </div>

      {/* Primary CTA — New Booking */}
      {!collapsed && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => openNewReservation()}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#1e40af] hover:bg-[#1e3a8a] text-white font-semibold text-sm py-3 rounded-xl transition-colors min-h-[44px] shadow-sm"
          >
            הזמנה חדשה
            <Icon name="add_circle" size="sm" />
          </button>
        </div>
      )}
      {collapsed && (
        <div className="px-4 pb-4 flex justify-center">
          <button
            type="button"
            onClick={() => openNewReservation()}
            aria-label="הזמנה חדשה"
            className="w-12 h-12 inline-flex items-center justify-center bg-[#1e40af] hover:bg-[#1e3a8a] text-white rounded-xl transition-colors shadow-sm"
          >
            <Icon name="add" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {visibleNav.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-xl px-4 py-2.5 min-h-[44px] transition-colors duration-200 ${
                active
                  ? "bg-[#eff6ff] text-[#1e40af] font-semibold"
                  : "text-[#474747] hover:bg-[#f4f2fc] font-medium"
              } ${collapsed ? "justify-center px-3" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute right-0 top-[20%] h-[60%] w-1 rounded-l-sm bg-[#1e40af]"
                />
              )}
              {!collapsed && <span className="flex-1 text-sm">{item.label}</span>}
              <Icon name={item.icon} filled={active} size="md" />
            </Link>
          )
        })}
      </div>

      {/* Bottom section — system links */}
      <div className="px-3 pt-3 pb-2 space-y-1 border-t border-[#dad9e3]">
        {visibleBottom.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-xl px-4 py-2.5 min-h-[44px] transition-colors duration-200 ${
                active
                  ? "bg-[#eff6ff] text-[#1e40af] font-semibold"
                  : "text-[#474747] hover:bg-[#f4f2fc] font-medium"
              } ${collapsed ? "justify-center px-3" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute right-0 top-[20%] h-[60%] w-1 rounded-l-sm bg-[#1e40af]"
                />
              )}
              {!collapsed && <span className="flex-1 text-sm">{item.label}</span>}
              <Icon name={item.icon} filled={active} size="sm" />
            </Link>
          )
        })}
      </div>

      {/* Logout — bottom, separated, red */}
      <div className="px-3 pb-3 pt-2 border-t border-[#dad9e3]">
        <button
          type="button"
          onClick={handleLogout}
          className={`flex items-center gap-3 rounded-xl px-4 py-2.5 min-h-[44px] w-full text-[#dc2626] hover:bg-[#fee2e2] font-semibold transition-colors ${
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
        className="absolute left-[-14px] top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border border-[#dad9e3] shadow-md hover:bg-[#f4f2fc] hover:border-[#1e40af] hover:text-[#1e40af] flex items-center justify-center text-[#474747] transition-colors z-50"
      >
        <Icon name={collapsed ? "chevron_left" : "chevron_right"} size="sm" />
      </button>
    </nav>
  )
}
