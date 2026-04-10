"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/shared/Icon"
import { useReservationFormStore } from "@/lib/stores/reservation-form-store"
import { usePermissions } from "@/lib/hooks/use-tenant"

const NAV_ITEMS = [
  { href: "/dashboard", icon: "dashboard", label: "דשבורד", module: "dashboard" },
  { href: "/calendar", icon: "calendar_today", label: "לוח תפוסה", module: "calendar" },
  { href: "/reservations", icon: "book_online", label: "הזמנות", module: "reservations" },
  { href: "/guests", icon: "group", label: "אורחים", module: "guests" },
  { href: "/rooms", icon: "bed", label: "חדרים", module: "rooms" },
  { href: "/housekeeping", icon: "local_laundry_service", label: "ניקיון", module: "housekeeping" },
  { href: "/maintenance", icon: "construction", label: "תחזוקה", module: "maintenance" },
  { href: "/staff", icon: "badge", label: "עובדים", module: "staff" },
  { href: "/documents", icon: "description", label: "מסמכים", module: "documents" },
  { href: "/finance", icon: "payments", label: "כספים", module: "finance" },
  { href: "/suppliers", icon: "local_shipping", label: "ספקים", module: "suppliers" },
  { href: "/reports", icon: "bar_chart", label: "דוחות", module: "reports" },
]

const BOTTOM_ITEMS = [
  { href: "/channels", icon: "hub", label: "אינטגרציות", module: "channels" },
  { href: "/settings", icon: "settings", label: "הגדרות", module: "settings" },
  { href: "/permissions", icon: "admin_panel_settings", label: "הרשאות", module: "permissions" },
]

interface SidebarProps {
  tenantName?: string
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ tenantName = "GuestHub", collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const openNewReservation = useReservationFormStore((s) => s.open)
  const { can } = usePermissions()

  const visibleNav = NAV_ITEMS.filter((item) => can(item.module, "view"))
  const visibleBottom = BOTTOM_ITEMS.filter((item) => can(item.module, "view"))

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <nav className={`h-screen fixed right-0 top-0 border-l border-sidebar-border bg-sidebar flex flex-col z-50 transition-all duration-300 ${collapsed ? "w-20" : "w-72"}`}>
      {/* Logo */}
      <div className="p-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-white shadow-sm flex-shrink-0">
          <Icon name="hotel_class" filled />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground tracking-tight truncate">{tenantName}</h1>
            <p className="text-xs text-muted-foreground font-medium">Property Management</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {visibleNav.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 min-h-[44px] transition-all duration-200 ease-out ${
                active
                  ? "bg-sidebar-active text-primary shadow-sm font-medium"
                  : "text-sidebar-foreground hover:text-foreground hover:bg-accent"
              } ${collapsed ? "justify-center px-3" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon name={item.icon} filled={active} size="md" />
              {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
            </Link>
          )
        })}
      </div>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-1 border-t border-sidebar-border pt-4">
        {!collapsed && (
          <div className="space-y-2 mb-4">
            <button
              onClick={() => openNewReservation()}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-primary-container text-white py-3 rounded-xl font-semibold shadow-sm active:scale-95 transition-transform text-sm cursor-pointer hover:shadow-md min-h-[44px]"
            >
              <Icon name="add" size="sm" />
              הזמנה חדשה
            </button>
            <button
              onClick={async () => {
                const { createClientSupabase } = await import("@/lib/supabase/client")
                const supabase = createClientSupabase()
                await supabase.auth.signOut()
                window.location.href = "/login"
              }}
              className="w-full flex items-center justify-center gap-2 border border-border text-foreground py-2.5 rounded-xl font-medium hover:bg-accent transition-colors text-sm cursor-pointer min-h-[44px]"
            >
              <Icon name="logout" size="sm" />
              התנתקות
            </button>
          </div>
        )}

        {visibleBottom.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 min-h-[44px] transition-all duration-200 ${
                active
                  ? "bg-sidebar-active text-primary shadow-sm"
                  : "text-sidebar-foreground hover:text-foreground hover:bg-accent"
              } ${collapsed ? "justify-center px-3" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon name={item.icon} size="sm" />
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </Link>
          )
        })}

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="flex items-center gap-3 rounded-xl px-4 py-2.5 min-h-[44px] text-sidebar-foreground hover:text-foreground hover:bg-accent transition-all w-full"
        >
          <Icon name={collapsed ? "chevron_left" : "chevron_right"} size="sm" />
          {!collapsed && <span className="text-sm">כווץ תפריט</span>}
        </button>
      </div>
    </nav>
  )
}
